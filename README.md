# MailMind AI

An AI-powered Gmail Intelligence Platform built with the MERN stack. Connect your Gmail, sync emails, get AI summaries, categorize messages, compose drafts, and chat with a RAG-based assistant over your inbox.

## Features

- **Google OAuth 2.0** — Secure Gmail connection via Gmail API (no IMAP/SMTP)
- **Email Sync** — Initial and incremental sync with pagination, retries, and rate-limit handling
- **AI Summarization** — Email and thread summaries powered by Google Gemini
- **Smart Categorization** — Auto-classify into Newsletter, Job, Finance, Notifications, Personal, Work
- **AI Compose & Reply** — Generate new emails and thread-aware replies with proper headers
- **RAG Chat Assistant** — Ask questions about your emails with source citations
- **News Digest** — Semantic deduplication of newsletter stories (bonus feature)

## Tech Stack

| Layer        | Technology                                                             |
| ------------ | ---------------------------------------------------------------------- |
| Frontend     | React, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand |
| Backend      | Node.js, Express, TypeScript                                           |
| Database     | Supabase PostgreSQL + pgvector                                         |
| Auth         | Google OAuth 2.0                                                       |
| AI Primary   | Google Gemini API                                                      |
| AI Secondary | NVIDIA NIM (embeddings + reranking)                                    |
| Deployment   | Vercel (frontend), Render/Railway (backend)                            |

## Project Structure

```
mailmind-ai/
├── client/          # React frontend (Vite)
├── server/          # Express API
│   ├── migrations/  # Supabase SQL schema
│   └── src/
│       ├── modules/ # Feature modules (auth, gmail, chat, etc.)
│       ├── services/
│       ├── repositories/
│       └── ...
├── README.md
├── Architecture.md
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project with pgvector enabled
- Google Cloud project with Gmail API + OAuth credentials
- Gemini API key
- NVIDIA API key (free tier)

### 1. Database Setup

Run the migration in Supabase SQL Editor:

```bash
# File: server/migrations/001_initial_schema.sql
```

Enable the `vector` extension if not already enabled.

### 2. Backend

```bash
cd server
npm install
cp ../.env.example .env   # Fill in your credentials
npm run dev
```

Server runs at `http://localhost:5020`.

### 3. Frontend

```bash
cd client
npm install
cp ../.env.example .env   # Set VITE_API_URL and Supabase keys
npm run dev
```

Frontend runs at `http://localhost:5183`.

### 4. Google OAuth Setup

1. Create OAuth 2.0 credentials in Google Cloud Console
2. Enable Gmail API
3. Add redirect URI: `http://localhost:5020/api/auth/google/callback`
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in server `.env`

## API Endpoints

| Method | Endpoint                           | Description             |
| ------ | ---------------------------------- | ----------------------- |
| GET    | `/api/auth/google`                 | Get OAuth URL           |
| GET    | `/api/auth/google/callback`        | OAuth callback          |
| GET    | `/api/auth/me`                     | Current user            |
| POST   | `/api/auth/logout`                 | Logout                  |
| POST   | `/api/gmail/sync`                  | Trigger Gmail sync      |
| GET    | `/api/gmail/status`                | Sync status & stats     |
| GET    | `/api/emails`                      | List emails (paginated) |
| GET    | `/api/emails/:id`                  | Email detail            |
| GET    | `/api/emails/threads/:id`          | Thread detail           |
| GET    | `/api/summary/emails/:id/summary`  | Email summary           |
| GET    | `/api/summary/threads/:id/summary` | Thread summary          |
| POST   | `/api/compose`                     | AI compose email        |
| POST   | `/api/reply`                       | AI thread reply         |
| GET    | `/api/categories`                  | Category counts         |
| POST   | `/api/chat`                        | RAG chat message        |
| GET    | `/api/newsletter/digest`           | News digest             |

## NVIDIA NIM Usage

NVIDIA NIM free-tier models are used for:

- **Embeddings** (`nvidia/nv-embedqa-e5-v5`) — Vector representations for RAG retrieval
- **Reranking** (`nvidia/nv-rerankqa-mistral-4b-v3`) — Re-order retrieved documents for better context
- **Classification fallback** — Rule-based fallback when Gemini classification fails

See [Architecture.md](./Architecture.md) for detailed design decisions.

## Deployment

### Frontend (Vercel)

```bash
cd client
npm run build
# Deploy dist/ to Vercel, set VITE_API_URL to production API
```

### Backend (Render / Railway)

```bash
cd server
npm run build
npm start
# Set all env vars from .env.example
# Update GOOGLE_REDIRECT_URI and CLIENT_URL for production
```

## Limitations (MVP)

- Sync and AI processing run **on-demand** (no background workers)
- Max 500 messages per sync batch to respect API quotas
- Embedding generation is sequential (not batched)
- Long sync operations may timeout on serverless hosts

See Architecture.md for future improvements including BullMQ workers.

## License

MIT
