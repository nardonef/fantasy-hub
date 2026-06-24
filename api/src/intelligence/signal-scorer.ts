import type { Signal } from "../generated/prisma/client";

export type Sentiment = "positive" | "negative" | "neutral";

export interface PlayerScore {
  score: number;
  sentiment: Sentiment;
  confidence: 1 | 2 | 3 | 4;
}

const NEGATIVE_KEYWORDS = [
  "questionable",
  "doubtful",
  "out",
  " ir ",
  "injured",
  "limited",
  "dnp",
  "did not practice",
  "placed on",
  "will not play",
  "ruled out",
];

const POSITIVE_KEYWORDS = [
  "must start",
  "must-start",
  "start him",
  "breakout",
  "boom",
  "hot",
  "trending up",
  "ranking up",
  "waiver pickup",
  "add him",
  "fire up",
  "must add",
  "full practice",
  "cleared",
  "no injury",
  "returned to practice",
];

/**
 * Recency weights for signal scoring.
 * Signals older than 7 days are ignored (weight = 0).
 */
function recencyWeight(signal: Signal): number {
  const ageMs = Date.now() - signal.publishedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 24) return 1.0;
  if (ageHours <= 48) return 0.5;
  if (ageHours <= 168) return 0.1; // up to 7 days
  return 0;
}

function classifySentiment(signals: Signal[]): Sentiment {
  let positiveScore = 0;
  let negativeScore = 0;

  for (const signal of signals) {
    const text = signal.content.toLowerCase();
    const weight = recencyWeight(signal);
    if (weight === 0) continue;

    if (NEGATIVE_KEYWORDS.some((kw) => text.includes(kw))) {
      negativeScore += weight;
    } else if (POSITIVE_KEYWORDS.some((kw) => text.includes(kw))) {
      positiveScore += weight;
    }
  }

  if (negativeScore > positiveScore) return "negative";
  if (positiveScore > negativeScore) return "positive";
  return "neutral";
}

/**
 * Score a player's recent signals.
 *
 * Returns a weighted activity score, overall sentiment, and confidence (1-4)
 * based on distinct signal source count.
 */
export function scorePlayer(signals: Signal[]): PlayerScore {
  const active = signals.filter((s) => recencyWeight(s) > 0);
  if (active.length === 0) {
    return { score: 0, sentiment: "neutral", confidence: 1 };
  }

  const score = active.reduce((sum, s) => sum + recencyWeight(s), 0);
  const sentiment = classifySentiment(active);
  const distinctSources = new Set(active.map((s) => s.source)).size;
  const confidence = Math.min(4, Math.max(1, distinctSources)) as 1 | 2 | 3 | 4;

  return { score, sentiment, confidence };
}

/**
 * Returns signals from the last 48 hours for injury-urgency checks.
 * Generic so the caller's richer type (e.g. Signal & { player }) is preserved.
 */
export function recentInjurySignals<T extends Signal>(signals: T[]): T[] {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  return signals.filter((s) => {
    if (s.publishedAt.getTime() < cutoff) return false;
    const text = s.content.toLowerCase();
    return NEGATIVE_KEYWORDS.some((kw) => text.includes(kw));
  });
}

/**
 * Returns signals from the last 48 hours with high Reddit engagement.
 * Generic so the caller's richer type (e.g. Signal & { player }) is preserved.
 */
export function hotRedditSignals<T extends Signal>(signals: T[], minScore = 200): T[] {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  return signals.filter((s) => {
    if (s.source !== "REDDIT") return false;
    if (s.publishedAt.getTime() < cutoff) return false;
    const meta = s.metadata as Record<string, unknown> | null;
    return typeof meta?.score === "number" && meta.score >= minScore;
  });
}

/**
 * Returns FantasyPros signals with a ranking move >= threshold spots.
 * Generic so the caller's richer type (e.g. Signal & { player }) is preserved.
 */
export function rankingShiftSignals<T extends Signal>(signals: T[], minDelta = 5): T[] {
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  return signals.filter((s) => {
    if (s.source !== "FANTASYPROS") return false;
    if (s.publishedAt.getTime() < cutoff) return false;
    const meta = s.metadata as Record<string, unknown> | null;
    return typeof meta?.rankDelta === "number" && Math.abs(meta.rankDelta) >= minDelta;
  });
}
