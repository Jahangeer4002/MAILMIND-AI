export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  updated_at: string;
}

export interface GmailAccount {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  history_id: number | null;
  last_sync_at: string | null;
  sync_status: 'idle' | 'syncing' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Thread {
  id: string;
  gmail_account_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  message_count: number;
  last_message_at: string | null;
  is_unread: boolean;
  label_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  gmail_account_id: string;
  thread_id: string | null;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  received_at: string | null;
  is_unread: boolean;
  label_ids: string[];
  in_reply_to: string | null;
  references_header: string | null;
  headers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmailSummary {
  id: string;
  email_id: string;
  summary: string;
  action_items: string[];
  key_points: string[];
  model: string;
}

export interface ThreadSummary {
  id: string;
  thread_id: string;
  summary: string;
  action_items: string[];
  key_decisions: string[];
  model: string;
}

export interface EmailCategory {
  id: string;
  email_id: string;
  category: string;
  confidence: number;
  source: string;
}

export interface SyncJob {
  id: string;
  gmail_account_id: string;
  job_type: 'initial' | 'incremental';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ChatCitation {
  emailId: string;
  subject: string;
  sender: string;
  date: string;
  threadId: string;
  snippet: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
