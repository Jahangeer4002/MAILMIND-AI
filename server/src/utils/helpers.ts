import { logger } from '../config/logger.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 32000,
  retryOn: (error: unknown) => {
    const err = error as { code?: number; status?: number; message?: string };
    return (
      err.code === 429 ||
      err.status === 429 ||
      err.code === 500 ||
      err.status === 500 ||
      err.code === 503 ||
      err.status === 503 ||
      (err.message?.includes('Quota exceeded') ?? false)
    );
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !opts.retryOn(error)) {
        throw error;
      }

      const delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
      const jitter = Math.random() * 0.3 * delay;
      const waitMs = delay + jitter;

      logger.warn(
        { attempt: attempt + 1, waitMs, label, error: (error as Error).message },
        'Retrying after error'
      );

      await sleep(waitMs);
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function extractEmailBody(payload: {
  body?: { data?: string | null };
  parts?: Array<{ mimeType?: string; body?: { data?: string | null }; parts?: unknown[] }>;
}): { text: string; html: string } {
  let text = '';
  let html = '';

  type MessagePart = {
    mimeType?: string;
    body?: { data?: string | null };
    parts?: MessagePart[];
  };

  function walk(part: MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const p of part.parts) walk(p);
    }
  }

  if (payload.body?.data) {
    text = decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) walk(part as MessagePart);
  }

  return { text, html };
}

export function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return { name: match[1]?.trim() || '', email: match[2].trim() };
  }
  return { name: '', email: raw.trim() };
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chunkText(text: string, maxChars = 4000, overlap = 200): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      const breakPoint = text.lastIndexOf('\n', end);
      if (breakPoint > start + maxChars / 2) {
        end = breakPoint;
      }
    }
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
