export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  gmailConnected: boolean;
}

export interface Email {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  snippet: string | null;
  received_at: string | null;
  is_unread: boolean;
  gmail_thread_id: string;
  thread_id: string | null;
  body_text: string | null;
  body_html: string | null;
  email_categories?: Array<{ category: string; confidence: number }>;
  email_summaries?: { summary: string; action_items: string[]; key_points: string[] };
}

export interface Thread {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  message_count: number;
  is_unread: boolean;
  last_message_at: string | null;
  emails?: Email[];
  thread_summaries?: { summary: string; action_items: string[]; key_decisions: string[] };
}

export interface ChatCitation {
  emailId: string;
  subject: string;
  sender: string;
  date: string;
  threadId: string;
  snippet: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
}

export interface SyncStatus {
  connected: boolean;
  syncStatus?: string;
  lastSyncAt?: string;
  stats?: { totalEmails: number; unreadEmails: number; totalThreads: number };
  latestJob?: { status: string; progress: Record<string, unknown> };
}

export interface Category {
  name: string;
  count: number;
}

export interface NewsStory {
  story: string;
  summary: string;
  sources: string[];
}
