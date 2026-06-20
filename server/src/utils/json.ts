import { EMAIL_CATEGORIES } from '../config/env.js';

export function parseJsonFromText<T>(text: string, fallback: T): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch {
        // fall through
      }
    }
  }

  return fallback;
}

export function normalizeCategories(
  categories: Array<{ category: string; confidence: number }>
): Array<{ category: string; confidence: number }> {
  const allowed = EMAIL_CATEGORIES as readonly string[];

  const normalized = categories
    .map((entry) => {
      const match = allowed.find(
        (label) => label.toLowerCase() === entry.category.trim().toLowerCase()
      );
      if (!match) return null;

      const confidence = Number(entry.confidence);
      return {
        category: match,
        confidence: Number.isFinite(confidence)
          ? Math.min(1, Math.max(0, confidence))
          : 0.5,
      };
    })
    .filter((entry): entry is { category: string; confidence: number } => entry !== null);

  const unique = new Map<string, { category: string; confidence: number }>();
  for (const entry of normalized) {
    const existing = unique.get(entry.category);
    if (!existing || entry.confidence > existing.confidence) {
      unique.set(entry.category, entry);
    }
  }

  return [...unique.values()];
}
