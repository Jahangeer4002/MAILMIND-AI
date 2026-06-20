import { extractNewsletterItems } from '../services/gemini.service.js';
import { generateEmbedding } from '../services/nvidia.service.js';
import { NewsletterRepository, GmailAccountRepository } from '../repositories/index.js';
import { cosineSimilarity } from '../utils/helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';

const newsletterRepo = new NewsletterRepository();
const gmailAccountRepo = new GmailAccountRepository();

const SIMILARITY_THRESHOLD = 0.85;

export async function generateNewsDigest(userId: string, days = 7) {
  const account = await gmailAccountRepo.findByUserId(userId);
  if (!account) throw new Error('Gmail account not connected');

  const newsletterEmails = await newsletterRepo.getRecentNewsletterEmails(account.id, days);

  interface StoryItem {
    title: string;
    summary: string;
    source: string;
    emailId: string;
    embedding: number[];
    groupId: string;
  }

  const allItems: StoryItem[] = [];

  for (const email of newsletterEmails.slice(0, 20)) {
    try {
      const items = await extractNewsletterItems(
        email.subject ?? '',
        email.body_text ?? email.snippet ?? '',
        email.from_name || email.from_email || 'Newsletter'
      );

      for (const item of items) {
        const embedText = `${item.title} ${item.summary}`;
        const embedding = await generateEmbedding(embedText);

        await newsletterRepo.upsertItem({
          email_id: email.id,
          story_title: item.title,
          story_summary: item.summary,
          source_name: email.from_name || email.from_email || 'Unknown',
          embedding,
        });

        allItems.push({
          title: item.title,
          summary: item.summary,
          source: email.from_name || email.from_email || 'Unknown',
          emailId: email.id,
          embedding,
          groupId: uuidv4(),
        });
      }
    } catch (error) {
      logger.warn({ error, emailId: email.id }, 'Failed to extract newsletter items');
    }
  }

  const groups: Array<{
    story: string;
    summary: string;
    sources: string[];
  }> = [];

  const used = new Set<number>();

  for (let i = 0; i < allItems.length; i++) {
    if (used.has(i)) continue;

    const group = [allItems[i]];
    used.add(i);

    for (let j = i + 1; j < allItems.length; j++) {
      if (used.has(j)) continue;

      const similarity = cosineSimilarity(allItems[i].embedding, allItems[j].embedding);
      if (similarity >= SIMILARITY_THRESHOLD) {
        group.push(allItems[j]);
        used.add(j);
      }
    }

    const sources = [...new Set(group.map((g) => g.source))];
    groups.push({
      story: group[0].title,
      summary: group[0].summary,
      sources,
    });
  }

  return {
    period: `Last ${days} days`,
    totalNewsletters: newsletterEmails.length,
    uniqueStories: groups.length,
    stories: groups,
  };
}
