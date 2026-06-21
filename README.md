# MailMind AI

MailMind AI is an AI-powered Gmail Intelligence Platform that helps users manage and understand their inbox more efficiently. It securely connects to Gmail using Google OAuth 2.0 and the Gmail API, allowing users to sync emails, generate AI summaries, automatically categorize messages, compose and reply to emails using AI, and chat with their inbox through a Retrieval-Augmented Generation (RAG) assistant.

## ✨ Features

- 🔐 **Google OAuth 2.0 Authentication** with Gmail API
- 📥 **Automatic Gmail Sync** with incremental updates
- 🤖 **AI Email Summarization** using Google Gemini
- 🏷️ **Smart Email Categorization** into:
  - Newsletter
  - Job / Recruitment
  - Finance
  - Notifications
  - Personal
  - Work / Professional
- ✍️ **AI Email Composition & Smart Replies**
- 💬 **RAG-based AI Assistant** to search and answer questions from your emails
- 📰 **Newsletter & News Digest Generation**
- 🔍 **Semantic Search** using vector embeddings
- ⚡ **Embeddings & Reranking** powered by NVIDIA NIM
- 📊 **Modern Dashboard** with recent emails, statistics, and categories
- 📱 **Responsive UI** built with React and Tailwind CSS

---

# 🛠️ Tech Stack

| Layer | Technology |
|---------|------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| State Management | Zustand |
| Data Fetching | TanStack Query |
| Backend | Node.js, Express.js, TypeScript |
| Database | Supabase PostgreSQL |
| Authentication | Google OAuth 2.0 |
| AI Models | Google Gemini API |
| Embeddings | NVIDIA NIM |
| Vector Search | pgvector |
| Deployment | Vercel (Frontend), Render (Backend) |

---

# 📁 Project Structure

```text
mailmind-ai/
│
├── client/
│   ├── src/
│   ├── public/
│   └── ...
│
├── server/
│   ├── src/
│   │   ├── modules/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   └── config/
│   └── migrations/
│
├── README.md
├── Architecture.md
└── .env.example
```

---

# 🚀 Getting Started

## Prerequisites

- Node.js 18+
- Supabase Account
- Google Cloud Project
- Gmail API Enabled
- Google OAuth Credentials
- Google Gemini API Key
- NVIDIA API Key

---

## Backend Setup

```bash
cd server
npm install
npm run dev
```

Runs on:

```
http://localhost:5020
```

---

## Frontend Setup

```bash
cd client
npm install
npm run dev
```

Runs on:

```
http://localhost:5183
```

---

# 🔑 Google OAuth Configuration

1. Create OAuth credentials in Google Cloud Console.
2. Enable the Gmail API.
3. Add the following redirect URI:

```
http://localhost:5020/api/auth/google/callback
```

4. Configure:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

---

# 📡 API Endpoints

| Method | Endpoint | Description |
|----------|----------------------------------|------------------------|
| GET | `/api/auth/google` | Get Google OAuth URL |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/gmail/sync` | Trigger Gmail synchronization |
| GET | `/api/gmail/status` | Gmail sync status |
| GET | `/api/emails` | List emails |
| GET | `/api/emails/:id` | Get email details |
| GET | `/api/emails/threads/:id` | Get thread details |
| GET | `/api/summary/emails/:id/summary` | Email summary |
| GET | `/api/summary/threads/:id/summary` | Thread summary |
| POST | `/api/compose` | Generate email draft |
| POST | `/api/reply` | Generate AI reply |
| GET | `/api/categories` | Category statistics |
| POST | `/api/chat` | AI Assistant |
| GET | `/api/newsletter/digest` | Newsletter digest |

---

# 🧠 AI Features

### Google Gemini

- Email Summarization
- Thread Summarization
- AI Compose
- AI Reply
- Conversational RAG Assistant

### NVIDIA NIM

- Text Embeddings
- Semantic Retrieval
- Document Reranking

---

# 🔍 AI Assistant

The integrated assistant can answer questions such as:

- "Summarize today's emails."
- "Show emails from Toluna."
- "Did I receive any recruitment emails?"
- "List finance-related emails."
- "Find emails about internships."
- "What newsletters arrived this week?"

The assistant uses Retrieval-Augmented Generation (RAG) with semantic search and vector embeddings to provide accurate answers.

---

# 📦 Deployment

## Frontend (Vercel)

```bash
cd client
npm run build
```

Deploy the generated `dist` folder to Vercel.

Configure:

```
VITE_API_URL=https://mailmind-ai-5f9u.onrender.com/api
```

---

## Backend (Render)

```bash
cd server
npm install
npm run build
npm start
```

Configure production environment variables including:

- CLIENT_URL
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI
- GEMINI_API_KEY
- NVIDIA_API_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- JWT_SECRET

---

# ⚠️ Current Limitations

- Gmail synchronization is initiated on demand.
- AI functionality depends on available Gemini API quota.
- Maximum sync batch size is limited to avoid API rate limits.
- Embedding generation is sequential.
- Very large inboxes may require multiple sync operations.

---
# 🌐 Live Deployment

**Frontend (Vercel):**  
https://mailmind-ai-mu.vercel.app

**Backend API (Render):**  
https://mailmind-ai-5f9u.onrender.com

**API Health Check:**  
https://mailmind-ai-5f9u.onrender.com/api/health

---
> Developed with ❤️ by **Md Jahangeer**
