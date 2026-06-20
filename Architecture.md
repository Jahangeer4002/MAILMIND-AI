# MailMind AI — Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client (Vercel)                           │
│  React + TypeScript + Tailwind + React Query + Zustand            │
│  Pages: Dashboard, Inbox, Thread, Compose, Assistant, News        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST / HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Server (Render/Railway)                    │
│  Express + TypeScript                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │   Auth   │ │  Gmail   │ │ Summaries│ │   Chat   │ │  News   │  │
│  │  Module  │ │  Module  │ │  Module  │ │  (RAG)   │ │ Module  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘  │
│       │            │            │            │            │       │
│  ┌────┴────────────┴────────────┴────────────┴────────────┴────┐   │
│  │                    Service Layer                             │   │
│  │  Gmail API │ Gemini API │ NVIDIA NIM │ Sync │ RAG Pipeline  │   │
│  └────┬───────────────┬───────────────────────┬────────────────┘   │
│       │               │                       │                     │
│  ┌────┴─────┐   ┌─────┴──────┐         ┌─────┴──────┐              │
│  │Repository│   │ Middleware │         │   Utils    │              │
│  │  Layer   │   │ Auth/Error │         │ Retry/Chunk│              │
│  └────┬─────┘   └────────────┘         └────────────┘              │
└───────┼────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL + pgvector                  │
│  users │ gmail_accounts │ threads │ emails │ embeddings │ ...    │
└───────────────────────────────────────────────────────────────────┘
        ▲                              ▲
        │                              │
   Gmail API                      Gemini API
   (OAuth 2.0)                   NVIDIA NIM
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Google OAuth user profiles |
| `gmail_accounts` | OAuth tokens, history_id, sync state |
| `threads` | Gmail thread metadata (first-class entity) |
| `emails` | Individual messages with headers, body, references |
| `email_labels` | Gmail label definitions |
| `email_categories` | AI-assigned categories with confidence |
| `email_summaries` | Per-email AI summaries + action items |
| `thread_summaries` | Thread-level summaries + key decisions |
| `email_embeddings` | pgvector embeddings (768-dim) |
| `sync_jobs` | On-demand sync job tracking |
| `chat_sessions` / `chat_messages` | RAG assistant conversations |
| `newsletter_items` | Extracted news stories for dedup |

### Key Indexes

- `emails(received_at DESC)` — Inbox ordering
- `emails(from_email)` — Sender filtering
- `email_categories(category)` — Category filters
- `email_embeddings` HNSW index — Vector similarity search

### Vector Search

Custom PostgreSQL function `match_email_embeddings()` performs cosine similarity search scoped to the authenticated user's emails via join through `gmail_accounts`.

## AI Design

### Primary Model: Google Gemini

Used for all generative tasks:

| Task | Model | Approach |
|------|-------|----------|
| Email summarization | gemini-2.0-flash | Single-pass with JSON output |
| Thread summarization | gemini-2.0-flash | Chunked for long threads |
| Classification | gemini-2.0-flash | Multi-label JSON output |
| Compose / Reply | gemini-2.0-flash | Instruction-following |
| Chat (RAG) | gemini-2.0-flash | Context-grounded generation |
| Newsletter extraction | gemini-2.0-flash | Story item extraction |

### Secondary Model: NVIDIA NIM

**Why NVIDIA NIM was chosen:**

1. **Free-tier access** — No cost for development and moderate production use
2. **Specialized models** — NV-EmbedQA and NV-RerankQA are purpose-built for retrieval pipelines
3. **Separation of concerns** — Offloads embedding/reranking from Gemini, reducing latency and API costs
4. **High-quality embeddings** — NV-EmbedQA-E5-v5 produces 768-dim vectors optimized for semantic search
5. **Dedicated reranker** — NV-RerankQA improves precision over raw vector similarity alone

| Task | NVIDIA Model | Role |
|------|-------------|------|
| Embeddings | `nvidia/nv-embedqa-e5-v5` | Email body → vector for pgvector |
| Reranking | `nvidia/nv-rerankqa-mistral-4b-v3` | Re-score retrieved chunks |
| Classification fallback | Rule-based patterns | When Gemini fails |

## RAG Design

### Pipeline

```
User Query
    │
    ▼
Query Embedding (NVIDIA NIM)
    │
    ▼
Vector Search (pgvector, top-20, threshold 0.3)
    │
    ▼
Reranking (NVIDIA NIM, top-8)
    │
    ▼
Context Assembly (with email metadata)
    │
    ▼
Gemini Generation (with anti-hallucination system prompt)
    │
    ▼
Response + Citations (subject, sender, date, thread)
```

### Hallucination Prevention

1. System prompt explicitly restricts answers to provided context
2. Returns fixed message when no relevant emails found
3. Citations include email subject, sender, date, and thread ID
4. Conversation history limited to last 6 messages
5. Facts separated from generated summaries in prompt instructions

### Embedding Storage

Embeddings stored for:
- Email body text (primary retrieval source)
- Thread summaries (future: thread-level retrieval)
- Newsletter items (deduplication)

## Gmail Sync Strategy

### Initial Sync

1. Fetch all message IDs via paginated `messages.list` (100 per page)
2. For each message: fetch full content, parse headers/body
3. Upsert thread and email records
4. Run AI pipeline: summarize, classify, embed
5. Store Gmail `historyId` for incremental sync
6. Batch limit: 500 messages per sync invocation

### Incremental Sync

1. Use stored `historyId` with `history.list` API
2. Process only `messagesAdded` events
3. Update `historyId` after successful sync

### On-Demand Processing

No BullMQ/Redis workers in MVP. Sync triggered via `POST /api/gmail/sync`. AI processing (summarize, classify, embed) runs inline during sync.

## Pagination Strategy

### Gmail API

- `messages.list`: 100 messages per page, follow `nextPageToken`
- Exponential backoff on 429/5xx (base 1s, max 32s, 5 retries with jitter)

### Application API

- `GET /api/emails?page=1&limit=20`
- Supabase `.range(offset, offset + limit - 1)` with total count
- Frontend "Load More" button for infinite-style pagination

## Rate Limiting Strategy

### Gmail API Quotas

- Exponential backoff with jitter on 429 responses
- Retry up to 5 times per request
- Batch size of 50 message IDs per page
- Max 500 messages per sync to avoid timeout

### AI API Quotas

- Graceful degradation: sync continues if AI processing fails for individual emails
- Summaries generated on-demand via dedicated endpoints as fallback
- Sequential embedding generation to avoid burst rate limits

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| On-demand sync vs workers | Simpler deployment, no Redis | Long syncs block HTTP request |
| Gemini for generation, NVIDIA for embeddings | Best model per task | Two API dependencies |
| 500 msg sync cap | Respects quotas/timeouts | Large inboxes need multiple syncs |
| Inline AI during sync | Data ready immediately | Slower sync, higher API usage |
| JWT in httpOnly cookie | Secure auth | Cross-domain complexity |
| pgvector in Supabase | Managed DB + vector search | 768-dim fixed dimension |

## Limitations

1. **Sync timeout** — Large mailboxes require multiple manual sync triggers
2. **No real-time updates** — Must manually sync for new emails
3. **Sequential embeddings** — Not optimized for bulk embedding generation
4. **Single Gmail account** — One account per user in current schema
5. **Serverless constraints** — Long-running sync may fail on cold-start platforms
6. **Label storage** — Labels fetched but not fully integrated in UI filters

## Future Improvements

### Background Processing (Priority)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Redis   │────▶│  BullMQ  │────▶│ Workers  │
│ (Upstash)│     │  Queues  │     │          │
└──────────┘     └──────────┘     └──────────┘

Queues:
- gmail-initial-sync
- gmail-incremental-sync
- email-summarization
- embedding-generation
- newsletter-deduplication
```

### Other Enhancements

- Webhook/push notifications via Gmail Pub/Sub for real-time sync
- Batch embedding API calls to NVIDIA
- Thread-level RAG retrieval using thread summaries
- Email attachment parsing and indexing
- Multi-account support
- Scheduled digest emails
- Caching layer (Redis) for frequent queries
- Streaming chat responses via SSE
- Fine-tuned classification model
- Email send with rich HTML formatting

## Security

- OAuth tokens stored encrypted at rest (Supabase)
- JWT authentication with httpOnly cookies
- Service role key used only server-side
- Input validation via Zod schemas
- Helmet.js security headers
- CORS restricted to client URL
- No API keys in client bundle
