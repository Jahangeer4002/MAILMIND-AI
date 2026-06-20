import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/helpers.js';

const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings';
const NVIDIA_RERANK_URL = 'https://integrate.api.nvidia.com/v1/ranking';
const EMBED_MODEL = 'nvidia/nv-embedqa-e5-v5';
const RERANK_MODEL = 'nvidia/nv-rerankqa-mistral-4b-v3';

/**
 * NVIDIA NIM is used for embeddings and reranking because:
 * 1. Free-tier access via NVIDIA API
 * 2. High-quality NV-EmbedQA model optimized for retrieval
 * 3. Dedicated reranking model improves RAG precision
 * 4. Offloads embedding compute from Gemini, reducing latency/cost
 */

export async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, 8000);

  return withRetry(async () => {
    const response = await fetch(NVIDIA_EMBED_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: [truncated],
        input_type: 'passage',
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, errText }, 'NVIDIA embedding failed');
      throw new Error(`NVIDIA embedding error: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    console.log("Embedding generated:", data.data?.[0]?.embedding?.length);
    return data.data[0].embedding;
  }, 'nvidia-embed');
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}

export interface RankedDocument {
  index: number;
  score: number;
  text: string;
}

export async function rerankDocuments(
  query: string,
  documents: string[],
  topK = 5
): Promise<RankedDocument[]> {
  if (documents.length === 0) return [];

  return withRetry(async () => {
    const passages = documents.map((text, index) => ({
      text,
      index,
    }));

    const response = await fetch(NVIDIA_RERANK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RERANK_MODEL,
        query: { text: query },
        passages,
        truncate: 'END',
      }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'NVIDIA rerank failed, using original order');
      return documents.slice(0, topK).map((text, index) => ({ index, score: 1 - index * 0.1, text }));
    }

    const data = (await response.json()) as {
      rankings: Array<{ index: number; logit: number }>;
    };

    return data.rankings
      .sort((a, b) => b.logit - a.logit)
      .slice(0, topK)
      .map((r) => ({
        index: r.index,
        score: r.logit,
        text: documents[r.index],
      }));
  }, 'nvidia-rerank');
}

export function classifyByRules(
  subject: string,
  from: string,
  body: string
): Array<{ category: string; confidence: number }> {
  const text = `${subject} ${from} ${body}`.toLowerCase();
  const rules: Array<{ category: string; patterns: RegExp[]; confidence: number }> = [
    {
      category: 'Newsletter',
      patterns: [/newsletter|unsubscribe|digest|weekly roundup|tldr|morning brew/i],
      confidence: 0.85,
    },
    {
      category: 'Job / Recruitment',
      patterns: [/recruiter|job alert|application|interview|hiring|careers@|linkedin/i],
      confidence: 0.85,
    },
    {
      category: 'Finance',
      patterns: [/invoice|payment|receipt|bank|transaction|billing|stripe|paypal/i],
      confidence: 0.85,
    },
    {
      category: 'Notifications',
      patterns: [/notification|alert|noreply|no-reply|automated|do not reply/i],
      confidence: 0.75,
    },
    {
      category: 'Work / Professional',
      patterns: [/meeting|project|team|deadline|standup|slack|jira|confluence/i],
      confidence: 0.7,
    },
  ];

  const matches: Array<{ category: string; confidence: number }> = [];
  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(text))) {
      matches.push({ category: rule.category, confidence: rule.confidence });
    }
  }

  if (matches.length === 0) {
    matches.push({ category: 'Personal', confidence: 0.6 });
  }

  return matches;
}
