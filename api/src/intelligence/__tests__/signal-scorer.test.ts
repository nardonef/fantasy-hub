import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Signal } from "../../generated/prisma/client";
import {
  scorePlayer,
  recentInjurySignals,
  hotRedditSignals,
  rankingShiftSignals,
} from "../signal-scorer";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSignal(overrides: Partial<Signal> & { publishedAt: Date }): Signal {
  return {
    id: "sig-" + Math.random().toString(36).slice(2),
    playerId: "player-1",
    source: "REDDIT",
    signalType: "SOCIAL_MENTION",
    content: "Patrick Mahomes looked great today",
    metadata: null,
    fetchedAt: new Date(),
    ...overrides,
  };
}

const NOW = new Date("2026-04-15T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

// ─── scorePlayer ────────────────────────────────────────────────────────────

describe("scorePlayer", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero score for empty signal list", () => {
    const result = scorePlayer([]);
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(1);
    expect(result.sentiment).toBe("neutral");
  });

  it("gives full weight to signals from the last 24h", () => {
    const signal = makeSignal({ publishedAt: hoursAgo(2) });
    const result = scorePlayer([signal]);
    expect(result.score).toBe(1.0);
  });

  it("gives half weight to signals from 24-48h ago", () => {
    const signal = makeSignal({ publishedAt: hoursAgo(36) });
    const result = scorePlayer([signal]);
    expect(result.score).toBe(0.5);
  });

  it("gives low weight to signals from 48h-7d ago", () => {
    const signal = makeSignal({ publishedAt: hoursAgo(72) });
    const result = scorePlayer([signal]);
    expect(result.score).toBeCloseTo(0.1, 5);
  });

  it("ignores signals older than 7 days", () => {
    const signal = makeSignal({ publishedAt: hoursAgo(200) });
    const result = scorePlayer([signal]);
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(1);
  });

  it("confidence reflects distinct source count (max 4)", () => {
    const signals = [
      makeSignal({ source: "REDDIT", publishedAt: hoursAgo(1) }),
      makeSignal({ source: "FANTASYPROS", publishedAt: hoursAgo(2) }),
      makeSignal({ source: "SPORTSDATA", publishedAt: hoursAgo(3) }),
    ];
    const result = scorePlayer(signals);
    expect(result.confidence).toBe(3);
  });

  it("caps confidence at 4", () => {
    const signals = [
      makeSignal({ source: "REDDIT", publishedAt: hoursAgo(1) }),
      makeSignal({ source: "FANTASYPROS", publishedAt: hoursAgo(2) }),
      makeSignal({ source: "SPORTSDATA", publishedAt: hoursAgo(3) }),
      makeSignal({ source: "TWITTER", publishedAt: hoursAgo(4) }),
      makeSignal({ source: "BLUESKY", publishedAt: hoursAgo(5) }),
    ];
    const result = scorePlayer(signals);
    expect(result.confidence).toBe(4);
  });

  it("detects negative sentiment from injury keywords", () => {
    const signal = makeSignal({
      content: "Justin Jefferson is questionable with a hamstring injury",
      publishedAt: hoursAgo(1),
    });
    const result = scorePlayer([signal]);
    expect(result.sentiment).toBe("negative");
  });

  it("detects positive sentiment from start keywords", () => {
    const signal = makeSignal({
      content: "CeeDee Lamb is a must start this week — trending up",
      publishedAt: hoursAgo(1),
    });
    const result = scorePlayer([signal]);
    expect(result.sentiment).toBe("positive");
  });

  it("returns neutral when no sentiment keywords match", () => {
    const signal = makeSignal({
      content: "Playoff picture looks interesting this week",
      publishedAt: hoursAgo(1),
    });
    const result = scorePlayer([signal]);
    expect(result.sentiment).toBe("neutral");
  });
});

// ─── recentInjurySignals ─────────────────────────────────────────────────────

describe("recentInjurySignals", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns signals containing injury keywords within 48h", () => {
    const injury = makeSignal({
      content: "Tyreek Hill is questionable (hamstring)",
      publishedAt: hoursAgo(6),
    });
    const clean = makeSignal({
      content: "Tyreek Hill caught 8 passes",
      publishedAt: hoursAgo(2),
    });
    expect(recentInjurySignals([injury, clean])).toEqual([injury]);
  });

  it("excludes injury signals older than 48h", () => {
    const old = makeSignal({
      content: "Player ruled out this week",
      publishedAt: hoursAgo(60),
    });
    expect(recentInjurySignals([old])).toHaveLength(0);
  });
});

// ─── hotRedditSignals ─────────────────────────────────────────────────────────

describe("hotRedditSignals", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Reddit signals with score >= threshold within 48h", () => {
    const hot = makeSignal({
      source: "REDDIT",
      publishedAt: hoursAgo(10),
      metadata: { score: 500 },
    });
    const low = makeSignal({
      source: "REDDIT",
      publishedAt: hoursAgo(10),
      metadata: { score: 50 },
    });
    expect(hotRedditSignals([hot, low])).toEqual([hot]);
  });

  it("ignores non-Reddit sources regardless of score", () => {
    const twitter = makeSignal({
      source: "TWITTER",
      publishedAt: hoursAgo(1),
      metadata: { score: 1000 },
    });
    expect(hotRedditSignals([twitter])).toHaveLength(0);
  });

  it("ignores Reddit posts older than 48h", () => {
    const old = makeSignal({
      source: "REDDIT",
      publishedAt: hoursAgo(72),
      metadata: { score: 999 },
    });
    expect(hotRedditSignals([old])).toHaveLength(0);
  });
});

// ─── rankingShiftSignals ──────────────────────────────────────────────────────

describe("rankingShiftSignals", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns FantasyPros signals with |rankDelta| >= minDelta within 72h", () => {
    const shift = makeSignal({
      source: "FANTASYPROS",
      publishedAt: hoursAgo(24),
      metadata: { rankDelta: 7 },
    });
    const small = makeSignal({
      source: "FANTASYPROS",
      publishedAt: hoursAgo(12),
      metadata: { rankDelta: 2 },
    });
    expect(rankingShiftSignals([shift, small])).toEqual([shift]);
  });

  it("handles negative rankDelta (drop in rankings)", () => {
    const drop = makeSignal({
      source: "FANTASYPROS",
      publishedAt: hoursAgo(12),
      metadata: { rankDelta: -8 },
    });
    expect(rankingShiftSignals([drop])).toEqual([drop]);
  });

  it("ignores non-FantasyPros sources", () => {
    const reddit = makeSignal({
      source: "REDDIT",
      publishedAt: hoursAgo(1),
      metadata: { rankDelta: 10 },
    });
    expect(rankingShiftSignals([reddit])).toHaveLength(0);
  });

  it("ignores FantasyPros signals older than 72h", () => {
    const old = makeSignal({
      source: "FANTASYPROS",
      publishedAt: hoursAgo(80),
      metadata: { rankDelta: 10 },
    });
    expect(rankingShiftSignals([old])).toHaveLength(0);
  });
});
