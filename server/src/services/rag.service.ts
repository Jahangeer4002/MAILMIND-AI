import { generateEmbedding, rerankDocuments } from '../services/nvidia.service.js';
import { chatWithContext } from '../services/gemini.service.js';
import { ChatCitation } from '../types/index.js';
import { logger } from '../config/logger.js';
import { getSupabase } from "../config/supabase.js";
import {
  EmbeddingRepository,
  EmailRepository,
  ChatRepository,
  GmailAccountRepository,
} from "../repositories/index.js";
const embeddingRepo = new EmbeddingRepository();
const emailRepo = new EmailRepository();
const chatRepo = new ChatRepository();
const gmailAccountRepo = new GmailAccountRepository();
export async function processChatMessage(
  userId: string,
  message: string,
  sessionId?: string
): Promise<{ answer: string; citations: ChatCitation[]; sessionId: string }> {
  let session;

  if (sessionId) {
    session = await chatRepo.getSession(sessionId);
  } else {
    session = await chatRepo.createSession(userId, message.slice(0, 50));
  }

  await chatRepo.addMessage(session.id, "user", message);
 

// Inside processChatMessage():
const account = await gmailAccountRepo.findByUserId(userId);

if (!account) {
  return {
    answer: "Gmail account is not connected.",
    citations: [],
    sessionId: session.id,
  };
}
  const lower = message.toLowerCase();

// Special handling for "today's emails"
if (
  lower.includes("today email") ||
  lower.includes("today emails") ||
  lower.includes("today's email") ||
  lower.includes("today's emails") ||
  lower.includes("summarize today") ||
  lower.includes("summarize today's")
) {


  if (account) {
    const supabase = getSupabase();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: todayEmails } = await supabase
      .from("emails")
      .select("subject, from_name, from_email, body_text, snippet")
      .eq("gmail_account_id", account.id)
      .gte("received_at", startOfDay.toISOString());

    if (todayEmails && todayEmails.length > 0) {
      const context = todayEmails
        .map(
          (e) => `
From: ${e.from_name || e.from_email}
Subject: ${e.subject}

${e.body_text || e.snippet}
`
        )
        .join("\n\n-----------------\n\n");

        let answer: string;

        try {
          answer = await chatWithContext(
            "Summarize today's emails",
            context,
            []
          );
        } catch (error: any) {
          console.error("Gemini Error:", error);
        
          if (
            error?.status === 429 ||
            error?.message?.includes("Too Many Requests") ||
            error?.message?.includes("Quota")
          ) {
            answer =
              "Sorry, the AI Assistant is temporarily unavailable because the Gemini API quota has been exceeded. Please try again later.";
          } else {
            answer =
              "Sorry, the AI Assistant is busy. Please try again after some time.";
          }
        }
        
        await chatRepo.addMessage(session.id, "assistant", answer, []);
        
        return {
          answer,
          citations: [],
          sessionId: session.id,
        };
    }

    return {
      answer: "You haven't received any emails today.",
      citations: [],
      sessionId: session.id,
    };
  }
}


  // -----------------------------
  // VECTOR SEARCH
  // -----------------------------
  let contextDocs: string[] = [];
  let citations: ChatCitation[] = [];

  try {
  let matches: any[] = [];

try {
  const queryEmbedding = await generateEmbedding(message);
  matches = await embeddingRepo.search(userId, queryEmbedding, 20, 0.2);
} catch (err) {
  logger.warn({ err }, "Embedding generation/search failed");
}

    contextDocs = matches.map((m: any) => m.content_text);

    if (contextDocs.length > 0) {
      try {
        const reranked = await rerankDocuments(message, contextDocs, 8);
    
        // If reranking succeeds and returns results, use them
        if (reranked && reranked.length > 0) {
          contextDocs = reranked.map((r) => r.text);
        }
      } catch (error) {
        logger.warn(
          { error },
          "Reranking failed. Using original retrieved documents."
        );
    
        // Keep the original contextDocs unchanged
      }
    }

    for (const match of matches.slice(0, 8)) {
      const email = match.email_id
        ? await emailRepo.findById(match.email_id)
        : null;

      if (email) {
        citations.push({
          emailId: email.id,
          subject: email.subject ?? "No subject",
          sender: email.from_name || email.from_email || "Unknown",
          date: email.received_at ?? "",
          threadId: email.gmail_thread_id,
          snippet: email.snippet ?? "",
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, "Embedding search failed");
  }

  // -----------------------------
  // FALLBACK KEYWORD SEARCH
  // -----------------------------
  const keywords = lower
  .replace(/[^a-z0-9\s]/g, " ")
  .split(/\s+/)
  .filter(
    (w) =>
      w.length > 2 &&
      ![
        "did",
        "have",
        "from",
        "email",
        "emails",
        "receive",
        "received",
        "show",
        "tell",
        "about",
        "what",
        "today",
        "summarize",
        "summary",
        "the",
        "any",
      ].includes(w)
  );

let data: any[] = [];

for (const word of keywords) {
  const result = await getSupabase()
    .from("emails")
    .select("*")
    .eq("gmail_account_id", account.id)
    .or(
      `subject.ilike.%${word}%,from_email.ilike.%${word}%,from_name.ilike.%${word}%,body_text.ilike.%${word}%`
    )
    .limit(10);

  if (result.data?.length) {
    data.push(...result.data);
  }
}

// Remove duplicates
data = Array.from(new Map(data.map((e) => [e.id, e])).values());
if (contextDocs.length === 0 && data.length > 0) {
  contextDocs = data.map(
    (e: any) =>
      `From: ${e.from_name || e.from_email}
Subject: ${e.subject}

${e.body_text || e.snippet || ""}`
  );

  citations = data.map((e: any) => ({
    emailId: e.id,
    subject: e.subject,
    sender: e.from_name || e.from_email,
    date: e.received_at,
    threadId: e.gmail_thread_id,
    snippet: e.snippet,
  }));
}
  // -----------------------------
  // GENERATE ANSWER
  // -----------------------------
  const history = (session.chat_messages ?? []).map((m: any) => ({
    role: m.role,
    content: m.content,
  }));

  let answer: string;

  if (contextDocs.length === 0) {
    answer =
  "Sorry, I couldn't find any relevant information in your emails for that question. Please try using different keywords or try again later.";
  } else {
    try {
      const context = contextDocs
        .map((d, i) => `[Email ${i + 1}]\n${d}`)
        .join("\n\n---\n\n");

        try {
          answer = await chatWithContext(message, context, history);
        } catch (err) {
          console.error(err);
        
          answer =
            "Sorry, the AI assistant is busy right now. Please try again after some time.";
        }
    } catch (err) {
      logger.error({ err }, "Gemini chat failed");

      answer =
        "Sorry, the AI assistant is currently busy. Please try again after some time.";
    }
  }

  await chatRepo.addMessage(session.id, "assistant", answer, citations);

  return {
    answer,
    citations,
    sessionId: session.id,
  };
}
       
