import { logger } from '../config/logger.js';
import {
  getGmailClient,
  listMessageIds,
  getMessage,
  listLabels,
  getHistory,
  parseGmailMessage,
  refreshAccessToken,
} from '../services/gmail.service.js';
import { summarizeEmail, classifyEmail } from '../services/gemini.service.js';
import { generateEmbedding, classifyByRules } from '../services/nvidia.service.js';
import {
  GmailAccountRepository,
  EmailRepository,
  SyncJobRepository,
  SummaryRepository,
  CategoryRepository,
  EmbeddingRepository,
} from '../repositories/index.js';
import { stripHtml } from '../utils/helpers.js';

const gmailAccountRepo = new GmailAccountRepository();
const emailRepo = new EmailRepository();
const syncJobRepo = new SyncJobRepository();
const summaryRepo = new SummaryRepository();
const categoryRepo = new CategoryRepository();
const embeddingRepo = new EmbeddingRepository();

const BATCH_SIZE = 50;
const MAX_MESSAGES_PER_SYNC = 500;

export async function runGmailSync(userId: string): Promise<{ jobId: string; message: string }> {
  const account = await gmailAccountRepo.findByUserId(userId);
  if (!account) throw new Error('Gmail account not connected');

  const isInitial = !account.history_id;
  const job = await syncJobRepo.create({
    gmail_account_id: account.id,
    job_type: isInitial ? 'initial' : 'incremental',
  });

  await gmailAccountRepo.updateSyncStatus(account.id, 'syncing');

  try {
    if (account.refresh_token) {
      const tokens = await refreshAccessToken(account.refresh_token);
      if (tokens.access_token) {
        await gmailAccountRepo.updateTokens(account.id, {
          access_token: tokens.access_token,
          token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : undefined,
        });
        account.access_token = tokens.access_token;
      }
    }

    const gmail = getGmailClient(account);

    if (isInitial) {
      await runInitialSync(gmail, account.id, job.id);
    } else {
      await runIncrementalSync(gmail, account, job.id);
    }

    const profile = await gmail.users.getProfile({ userId: 'me' });
    const historyId = profile.data.historyId ? parseInt(profile.data.historyId) : null;

    await gmailAccountRepo.updateSyncStatus(
      account.id,
      'idle',
      historyId ?? undefined,
      new Date().toISOString()
    );

    await syncJobRepo.update(job.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    return { jobId: job.id, message: isInitial ? 'Initial sync completed' : 'Incremental sync completed' };
  } catch (error) {
    logger.error({ error, userId }, 'Gmail sync failed');
    await gmailAccountRepo.updateSyncStatus(account.id, 'error');
    await syncJobRepo.update(job.id, {
      status: 'failed',
      error_message: (error as Error).message,
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}

async function runInitialSync(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  jobId: string
) {
  await syncLabels(gmail, accountId);

  let pageToken: string | undefined;
  let totalProcessed = 0;

  do {
    const { ids, nextPageToken } = await listMessageIds(gmail, pageToken, BATCH_SIZE);
    pageToken = nextPageToken;

    for (const messageId of ids) {
      if (totalProcessed >= MAX_MESSAGES_PER_SYNC) {
        logger.info('Reached max messages per sync batch');
        break;
      }

      await processMessage(gmail, accountId, messageId);
      totalProcessed++;

      if (totalProcessed % 10 === 0) {
        await syncJobRepo.update(jobId, {
          progress: { processed: totalProcessed, phase: 'messages' },
        });
      }
    }
  } while (pageToken && totalProcessed < MAX_MESSAGES_PER_SYNC);

  await syncJobRepo.update(jobId, {
    progress: { processed: totalProcessed, phase: 'complete' },
  });
}

async function runIncrementalSync(
  gmail: ReturnType<typeof getGmailClient>,
  account: { id: string; history_id: number | null },
  jobId: string
) {
  if (!account.history_id) {
    await runInitialSync(gmail, account.id, jobId);
    return;
  }

  let pageToken: string | undefined;
  let processed = 0;

  do {
    const history = await getHistory(gmail, String(account.history_id), pageToken);
    pageToken = history.nextPageToken ?? undefined;

    for (const record of history.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.id) {
          await processMessage(gmail, account.id, added.message.id);
          processed++;
        }
      }
    }
  } while (pageToken);

  await syncJobRepo.update(jobId, {
    progress: { processed, phase: 'incremental_complete' },
  });
}

async function syncLabels(gmail: ReturnType<typeof getGmailClient>, accountId: string) {
  const labels = await listLabels(gmail);
  for (const label of labels) {
    if (!label.id || !label.name) continue;
    await emailRepo.upsertEmail({
      gmail_account_id: accountId,
      gmail_message_id: `__label_${label.id}`,
      gmail_thread_id: `__label_${label.id}`,
      subject: label.name,
    }).catch(() => {
      // labels stored separately - skip if conflict
    });
  }
}

async function processMessage(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  messageId: string
) {
  const message = await getMessage(gmail, messageId);
  const parsed = parseGmailMessage(message);

  const thread = await emailRepo.upsertThread({
    gmail_account_id: accountId,
    gmail_thread_id: parsed.gmail_thread_id,
    subject: parsed.subject,
    snippet: parsed.snippet,
    last_message_at: parsed.received_at,
    is_unread: parsed.is_unread,
    label_ids: parsed.label_ids,
  });

  const email = await emailRepo.upsertEmail({
    gmail_account_id: accountId,
    thread_id: thread.id,
    ...parsed,
  });

  await processEmailAI(email.id, parsed.subject, parsed.body_text || stripHtml(parsed.body_html), parsed.from_email ?? '', parsed.from_name ?? '');
}

async function processEmailAI(
  emailId: string,
  subject: string,
  body: string,
  fromEmail: string,
  fromName: string
) {
  if (!body) body = "";


  try {
    const summary = await summarizeEmail(subject, body, fromName || fromEmail);
    await summaryRepo.upsertEmailSummary(emailId, summary.summary, summary.actionItems, summary.keyPoints);

    let categories: Array<{ category: string; confidence: number; source?: string }> = [];
    try {
      categories = await classifyEmail(subject, body, fromEmail);
    } catch (error) {
      logger.warn({ error, emailId }, 'Gemini classification failed, using rule fallback');
      categories = classifyByRules(subject, fromEmail, body).map((entry) => ({
        ...entry,
        source: 'rules',
      }));
    }

    if (categories.length === 0) {
      categories = classifyByRules(subject, fromEmail, body).map((entry) => ({
        ...entry,
        source: 'rules',
      }));
    }

    await categoryRepo.upsertCategories(emailId, categories);

    const embedText = `
Subject: ${subject}
From: ${fromName || fromEmail}
${body}
`.slice(0, 3000);
    const embedding = await generateEmbedding(embedText);
    await embeddingRepo.upsert({
      email_id: emailId,
      content_type: 'email_body',
      content_text: embedText,
      embedding,
      metadata: { subject, from: fromEmail },
    });
  } catch (error) {
    console.error("AI PROCESSING FAILED:", error);

    logger.warn({ error, emailId }, 'AI processing failed for email, continuing sync');
  }
}

export async function getSyncStatus(userId: string) {
  const account = await gmailAccountRepo.findByUserId(userId);
  if (!account) return { connected: false };

  const latestJob = await syncJobRepo.getLatest(account.id);
  const stats = await emailRepo.getStats(account.id);

  return {
    connected: true,
    syncStatus: account.sync_status,
    lastSyncAt: account.last_sync_at,
    historyId: account.history_id,
    latestJob,
    stats,
  };
}
