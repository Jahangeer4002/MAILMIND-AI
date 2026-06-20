import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { env, EMAIL_CATEGORIES } from '../config/env.js';
import { logger } from '../config/logger.js';
import { chunkText } from '../utils/helpers.js';
import { normalizeCategories, parseJsonFromText } from '../utils/json.js';
import { classifyByRules } from './nvidia.service.js';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
}

function getModel(modelName = 'gemini-2.0-flash', jsonMode = false): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: modelName,
    ...(jsonMode
      ? { generationConfig: { responseMimeType: 'application/json' } }
      : {}),
  });
}

export async function generateText(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  try {
    const model = getModel();

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: systemInstruction
        ? {
            role: "system",
            parts: [{ text: systemInstruction }],
          }
        : undefined,
    });

    return result.response.text();
  } catch (error: any) {
    logger.error({ error }, "Gemini generation failed");

    if (
      error?.status === 429 ||
      error?.message?.includes("Too Many Requests")
    ) {
      return "Sorry, the AI Assistant is busy. Please try again after some time.";
    }

    throw error;
  }
}

async function generateJson<T>(
  prompt: string,
  systemInstruction: string,
  fallback: T
): Promise<T> {
  try {
    const model = getModel('gemini-2.0-flash', true);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
    });
    return parseJsonFromText(result.response.text(), fallback);
  } catch (error) {
    logger.warn({ error }, 'Gemini JSON generation failed, using fallback');
    return fallback;
  }
}

export async function summarizeEmail(subject: string, body: string, from: string): Promise<{
  summary: string;
  actionItems: string[];
  keyPoints: string[];
}> {
  const prompt = `Summarize this email concisely. Extract action items and key points.

From: ${from}
Subject: ${subject}
Body:
${body.slice(0, 8000)}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "actionItems": ["item1", "item2"],
  "keyPoints": ["point1", "point2"]
}`;

  return generateJson(
    prompt,
    'You are an email summarization assistant. Return ONLY valid JSON, no markdown.',
    { summary: body.slice(0, 200), actionItems: [], keyPoints: [] }
  );
}

export async function summarizeThread(
  subject: string,
  messages: Array<{ from: string; date: string; body: string }>
): Promise<{
  summary: string;
  actionItems: string[];
  keyDecisions: string[];
}> {
  const fullText = messages
    .map((m) => `[${m.date}] ${m.from}:\n${m.body}`)
    .join('\n\n---\n\n');

  const chunks = chunkText(fullText, 12000);
  let combinedSummary = '';
  const allActionItems: string[] = [];
  const allDecisions: string[] = [];

  for (const chunk of chunks) {
    const prompt = `Summarize this email thread conversation. Preserve important decisions and action items.

Subject: ${subject}
Conversation:
${chunk}

Return ONLY valid JSON:
{
  "summary": "comprehensive summary",
  "actionItems": ["item1"],
  "keyDecisions": ["decision1"]
}`;

    const parsed = await generateJson(
      prompt,
      'You summarize email threads. Return ONLY valid JSON, no markdown.',
      { summary: '', actionItems: [], keyDecisions: [] }
    );
    combinedSummary += `${parsed.summary} `;
    allActionItems.push(...parsed.actionItems);
    allDecisions.push(...parsed.keyDecisions);
  }

  return {
    summary: combinedSummary.trim(),
    actionItems: [...new Set(allActionItems)],
    keyDecisions: [...new Set(allDecisions)],
  };
}

export async function classifyEmail(
  subject: string,
  body: string,
  from: string
): Promise<Array<{ category: string; confidence: number; source: string }>> {
  const prompt = `Classify the email into one or more of:

- Newsletter
- Job / Recruitment
- Finance
- Notifications
- Personal
- Work / Professional

From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 3000)}

Return ONLY valid JSON:

{
  "categories": [
    {
      "category": "Newsletter",
      "confidence": 0.98
    }
  ]
}`;

  const parsed = await generateJson<{ categories: Array<{ category: string; confidence: number }> }>(
    prompt,
    'You classify emails. Use only the allowed category labels exactly as written. Return ONLY valid JSON, no markdown or explanation.',
    { categories: [] }
  );

  const normalized = normalizeCategories(parsed.categories ?? []);
  if (normalized.length > 0) {
    return normalized.map((entry) => ({ ...entry, source: 'gemini' }));
  }

  return classifyByRules(subject, from, body).map((entry) => ({
    ...entry,
    source: 'rules',
  }));
}

export async function composeEmail(prompt: string): Promise<{
  subject: string;
  body: string;
  closing: string;
}> {
  return generateJson(
    `Write a professional email based on this instruction: "${prompt}"

Return ONLY valid JSON:
{
  "subject": "email subject line",
  "body": "email body paragraphs",
  "closing": "Best regards,\\n[Your Name]"
}`,
    'You write professional emails. Return ONLY valid JSON, no markdown.',
    { subject: 'Follow-up', body: prompt, closing: 'Best regards' }
  );
}

export async function draftReply(
  threadSubject: string,
  messages: Array<{ from: string; body: string }>,
  instruction: string
): Promise<{ subject: string; body: string }> {
  const conversation = messages
    .map((m) => `${m.from}: ${m.body.slice(0, 2000)}`)
    .join('\n\n');

  return generateJson(
    `Draft a reply for this email thread.

Thread Subject: ${threadSubject}
Conversation:
${conversation.slice(0, 10000)}

Reply instruction: ${instruction}

Return ONLY valid JSON:
{"subject": "Re: ...", "body": "reply body"}`,
    'Draft contextual email replies. Return ONLY valid JSON, no markdown.',
    { subject: `Re: ${threadSubject}`, body: instruction }
  );
}

export async function chatWithContext(
  question: string,
  context: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const systemInstruction = `You are an email intelligence assistant. Answer ONLY using the provided email context.
NEVER hallucinate or invent information not in the context.
If information is not available, respond: "Sorry, I couldn't find any matching information in your emails. Please try another question or try again later."
Always cite source emails by mentioning sender, subject, and date when referencing information.
Separate facts from your summaries clearly.`;

  const historyText = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `Email Context:
${context}

Conversation History:
${historyText}

User Question: ${question}

Provide a helpful answer based ONLY on the email context above. Include citations.`;

  return generateText(prompt, systemInstruction);
}

export async function extractNewsletterItems(
  subject: string,
  body: string,
  sourceName: string
): Promise<Array<{ title: string; summary: string }>> {
  const parsed = await generateJson<{ items: Array<{ title: string; summary: string }> }>(
    `Extract individual news stories from this newsletter email.

Source: ${sourceName}
Subject: ${subject}
Body: ${body.slice(0, 8000)}

Return ONLY valid JSON:
{"items": [{"title": "story title", "summary": "brief summary"}]}`,
    'Extract news items from newsletters. Return ONLY valid JSON, no markdown.',
    { items: [] }
  );
  return parsed.items ?? [];
}

export { EMAIL_CATEGORIES };
