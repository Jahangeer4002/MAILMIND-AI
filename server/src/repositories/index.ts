import { getSupabase } from "../config/supabase.js";
import { User, GmailAccount, Email, Thread, SyncJob } from "../types/index.js";

export class UserRepository {
  async findByGoogleId(googleId: string): Promise<User | null> {
    const { data, error } = await getSupabase()
      .from("users")
      .select("*")
      .eq("google_id", googleId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await getSupabase()
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  async upsert(
    user: Partial<User> & { google_id: string; email: string },
  ): Promise<User> {
    const { data, error } = await getSupabase()
      .from("users")
      .upsert(user, { onConflict: "google_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export class GmailAccountRepository {
  async findByUserId(userId: string): Promise<GmailAccount | null> {
    const { data, error } = await getSupabase()
      .from("gmail_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  async upsert(
    account: Partial<GmailAccount> & {
      user_id: string;
      email: string;
      access_token: string;
    },
  ): Promise<GmailAccount> {
    const { data, error } = await getSupabase()
      .from("gmail_accounts")
      .upsert(account, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTokens(
    id: string,
    tokens: { access_token: string; token_expiry?: string },
  ): Promise<void> {
    const { error } = await getSupabase()
      .from("gmail_accounts")
      .update(tokens)
      .eq("id", id);
    if (error) throw error;
  }

  async updateSyncStatus(
    id: string,
    status: string,
    historyId?: number,
    lastSyncAt?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = { sync_status: status };
    if (historyId !== undefined) update.history_id = historyId;
    if (lastSyncAt) update.last_sync_at = lastSyncAt;
    const { error } = await getSupabase()
      .from("gmail_accounts")
      .update(update)
      .eq("id", id);
    if (error) throw error;
  }
}

export class EmailRepository {
  async upsertEmail(
    email: Partial<Email> & {
      gmail_account_id: string;
      gmail_message_id: string;
      gmail_thread_id: string;
    },
  ): Promise<Email> {
    const { data, error } = await getSupabase()
      .from("emails")
      .upsert(email, { onConflict: "gmail_account_id,gmail_message_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async upsertThread(
    thread: Partial<Thread> & {
      gmail_account_id: string;
      gmail_thread_id: string;
    },
  ): Promise<Thread> {
    const { data, error } = await getSupabase()
      .from("threads")
      .upsert(thread, { onConflict: "gmail_account_id,gmail_thread_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findEmails(
    accountId: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      unread?: boolean;
    },
  ) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = getSupabase()
      .from("emails")
      .select(
        `
        *,
        email_categories!inner(category, confidence),
        email_summaries(summary)
      `,
        { count: "exact" },
      )
      .eq("gmail_account_id", accountId)
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.unread) query = query.eq("is_unread", true);
    if (options.search) {
      query = query.or(
        `subject.ilike.%${options.search}%,from_email.ilike.%${options.search}%,snippet.ilike.%${options.search}%`,
      );
    }

    if (options.category) {
      query = query.eq("email_categories.category", options.category);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      hasMore: (count ?? 0) > offset + limit,
    };
  }

  async findById(id: string): Promise<Email | null> {
    const { data, error } = await getSupabase()
      .from("emails")
      .select("*, email_categories(*), email_summaries(*)")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  async findThreadById(id: string) {
    // Try internal UUID first
    let { data, error } = await getSupabase()
      .from("threads")
      .select("*, thread_summaries(*), emails(*)")
      .eq("id", id)
      .maybeSingle();

    if (data) return data;

    // Fallback to Gmail thread id
    ({ data, error } = await getSupabase()
      .from("threads")
      .select("*, thread_summaries(*), emails(*)")
      .eq("gmail_thread_id", id)
      .maybeSingle());

    if (error) throw error;

    return data;
  }

  async findThreadByGmailId(
    accountId: string,
    gmailThreadId: string,
  ): Promise<Thread | null> {
    const { data, error } = await getSupabase()
      .from("threads")
      .select("*")
      .eq("gmail_account_id", accountId)
      .eq("gmail_thread_id", gmailThreadId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  async getEmailsByThread(threadId: string): Promise<Email[]> {
    const { data, error } = await getSupabase()
      .from("emails")
      .select("*")
      .eq("thread_id", threadId)
      .order("received_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getStats(accountId: string) {
    const { count: totalEmails } = await getSupabase()
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("gmail_account_id", accountId);

    const { count: unreadEmails } = await getSupabase()
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("gmail_account_id", accountId)
      .eq("is_unread", true);

    const { count: totalThreads } = await getSupabase()
      .from("threads")
      .select("*", { count: "exact", head: true })
      .eq("gmail_account_id", accountId);

    return {
      totalEmails: totalEmails ?? 0,
      unreadEmails: unreadEmails ?? 0,
      totalThreads: totalThreads ?? 0,
    };
  }
}

export class SyncJobRepository {
  async create(
    job: Partial<SyncJob> & { gmail_account_id: string; job_type: string },
  ): Promise<SyncJob> {
    const { data, error } = await getSupabase()
      .from("sync_jobs")
      .insert({
        ...job,
        status: "pending",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, update: Partial<SyncJob>): Promise<void> {
    const { error } = await getSupabase()
      .from("sync_jobs")
      .update(update)
      .eq("id", id);
    if (error) throw error;
  }

  async getLatest(accountId: string): Promise<SyncJob | null> {
    const { data, error } = await getSupabase()
      .from("sync_jobs")
      .select("*")
      .eq("gmail_account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }
}

export class EmbeddingRepository {
  async upsert(embedding: {
    email_id?: string;
    thread_id?: string;
    content_type: string;
    content_text: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await getSupabase()
      .from("email_embeddings")
      .insert({
        ...embedding,
        embedding: `[${embedding.embedding.join(",")}]`,
      });
    if (error) throw error;
  }

  async search(
    userId: string,
    queryEmbedding: number[],
    limit = 10,
    threshold = 0.2,
  ) {
    const { data, error } = await getSupabase().rpc("match_email_embeddings", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_user_id: userId,
      match_count: limit,
      match_threshold: threshold,
    });
    if (error) throw error;
    return data ?? [];
  }
}

export class SummaryRepository {
  async upsertEmailSummary(
    emailId: string,
    summary: string,
    actionItems: string[],
    keyPoints: string[],
  ): Promise<void> {
    const { error } = await getSupabase()
      .from("email_summaries")
      .upsert(
        {
          email_id: emailId,
          summary,
          action_items: actionItems,
          key_points: keyPoints,
          model: "gemini",
        },
        { onConflict: "email_id" },
      );
    if (error) throw error;
  }

  async upsertThreadSummary(
    threadId: string,
    summary: string,
    actionItems: string[],
    keyDecisions: string[],
  ): Promise<void> {
    const { error } = await getSupabase()
      .from("thread_summaries")
      .upsert(
        {
          thread_id: threadId,
          summary,
          action_items: actionItems,
          key_decisions: keyDecisions,
          model: "gemini",
        },
        { onConflict: "thread_id" },
      );
    if (error) throw error;
  }

  async getEmailSummary(emailId: string) {
    const { data } = await getSupabase()
      .from("email_summaries")
      .select("*")
      .eq("email_id", emailId)
      .single();
    return data;
  }

  async getThreadSummary(threadId: string) {
    const { data } = await getSupabase()
      .from("thread_summaries")
      .select("*")
      .eq("thread_id", threadId)
      .single();
    return data;
  }
}

export class CategoryRepository {
  async upsertCategories(
    emailId: string,
    categories: Array<{
      category: string;
      confidence: number;
      source?: string;
    }>,
  ): Promise<void> {
    for (const cat of categories) {
      const { error } = await getSupabase()
        .from("email_categories")
        .upsert(
          {
            email_id: emailId,
            category: cat.category,
            confidence: cat.confidence,
            source: cat.source ?? "gemini",
          },
          { onConflict: "email_id,category" },
        );
      if (error) throw error;
    }
  }

  async getCategoryCounts(accountId: string) {
    const { data, error } = await getSupabase()
      .from("email_categories")
      .select("category, emails!inner(gmail_account_id)")
      .eq("emails.gmail_account_id", accountId);
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
    return counts;
  }
}

export class ChatRepository {
  async createSession(userId: string, title?: string) {
    const { data, error } = await getSupabase()
      .from("chat_sessions")
      .insert({ user_id: userId, title: title ?? "New Chat" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getSession(sessionId: string) {
    const { data, error } = await getSupabase()
      .from("chat_sessions")
      .select("*, chat_messages(*)")
      .eq("id", sessionId)
      .single();
    if (error) throw error;
    return data;
  }

  async addMessage(
    sessionId: string,
    role: string,
    content: string,
    citations: unknown[] = [],
  ) {
    const { data, error } = await getSupabase()
      .from("chat_messages")
      .insert({ session_id: sessionId, role, content, citations })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getUserSessions(userId: string) {
    const { data, error } = await getSupabase()
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}

export class NewsletterRepository {
  async upsertItem(item: {
    email_id: string;
    story_title: string;
    story_summary: string;
    source_name: string;
    embedding?: number[];
    duplicate_group_id?: string;
  }) {
    const { data, error } = await getSupabase()
      .from("newsletter_items")
      .insert({
        ...item,
        embedding: item.embedding ? `[${item.embedding.join(",")}]` : null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getRecentNewsletterEmails(accountId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await getSupabase()
      .from("emails")
      .select("*, email_categories!inner(category)")
      .eq("gmail_account_id", accountId)
      .eq("email_categories.category", "Newsletter")
      .gte("received_at", since.toISOString())
      .order("received_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
