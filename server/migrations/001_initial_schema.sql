-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gmail accounts (OAuth tokens)
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  history_id BIGINT,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Labels
CREATE TABLE IF NOT EXISTS email_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  gmail_label_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gmail_account_id, gmail_label_id)
);

-- Threads
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_unread BOOLEAN DEFAULT FALSE,
  label_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gmail_account_id, gmail_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_account ON threads(gmail_account_id);
CREATE INDEX IF NOT EXISTS idx_threads_last_message ON threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_unread ON threads(gmail_account_id, is_unread);

-- Emails
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES threads(id) ON DELETE SET NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  subject TEXT,
  from_email TEXT,
  from_name TEXT,
  to_emails TEXT[] DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ,
  is_unread BOOLEAN DEFAULT FALSE,
  label_ids TEXT[] DEFAULT '{}',
  in_reply_to TEXT,
  references_header TEXT,
  headers JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gmail_account_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(gmail_account_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_thread ON emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_unread ON emails(gmail_account_id, is_unread);

-- Email categories
CREATE TABLE IF NOT EXISTS email_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.0,
  source TEXT DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_id, category)
);

CREATE INDEX IF NOT EXISTS idx_email_categories_category ON email_categories(category);
CREATE INDEX IF NOT EXISTS idx_email_categories_email ON email_categories(email_id);

-- Email summaries
CREATE TABLE IF NOT EXISTS email_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE UNIQUE,
  summary TEXT NOT NULL,
  action_items JSONB DEFAULT '[]',
  key_points JSONB DEFAULT '[]',
  model TEXT DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thread summaries
CREATE TABLE IF NOT EXISTS thread_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE UNIQUE,
  summary TEXT NOT NULL,
  action_items JSONB DEFAULT '[]',
  key_decisions JSONB DEFAULT '[]',
  model TEXT DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Embeddings (768 dimensions for NVIDIA NV-EmbedQA)
CREATE TABLE IF NOT EXISTS email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('email_body', 'thread_summary', 'newsletter_item')),
  content_text TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_email ON email_embeddings(email_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_thread ON email_embeddings(thread_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_type ON email_embeddings(content_type);

-- HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON email_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Sync jobs (tracking on-demand sync state)
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('initial', 'incremental')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_account ON sync_jobs(gmail_account_id);

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- Newsletter items (for deduplication)
CREATE TABLE IF NOT EXISTS newsletter_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  story_title TEXT NOT NULL,
  story_summary TEXT,
  source_name TEXT,
  embedding vector(768),
  duplicate_group_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_items_email ON newsletter_items(email_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_items_group ON newsletter_items(duplicate_group_id);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_email_embeddings(
  query_embedding vector(768),
  match_user_id UUID,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  email_id UUID,
  thread_id UUID,
  content_type TEXT,
  content_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ee.id,
    ee.email_id,
    ee.thread_id,
    ee.content_type,
    ee.content_text,
    ee.metadata,
    1 - (ee.embedding <=> query_embedding) AS similarity
  FROM email_embeddings ee
  JOIN emails e ON ee.email_id = e.id
  JOIN gmail_accounts ga ON e.gmail_account_id = ga.id
  WHERE ga.user_id = match_user_id
    AND ee.embedding IS NOT NULL
    AND 1 - (ee.embedding <=> query_embedding) > match_threshold
  ORDER BY ee.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER gmail_accounts_updated_at BEFORE UPDATE ON gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER threads_updated_at BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER emails_updated_at BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
