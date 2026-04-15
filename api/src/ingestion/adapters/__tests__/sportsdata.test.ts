import { describe, it, expect, vi, afterEach } from "vitest";
import { SportsdataAdapter } from "../sportsdata";
import type { PrismaClient } from "../../../generated/prisma/client";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_QB: Parameters<SportsdataAdapter["buildContent"]>[0] = {
  PlayerID: 1,
  Name: "Patrick Mahomes",
  Team: "KC",
  Position: "QB",
  Week: 5,
  Season: 2025,
  PassingYards: 312,
  PassingTouchdowns: 3,
  PassingInterceptions: 0,
  RushingAttempts: 4,
  RushingYards: 22,
  RushingTouchdowns: 0,
  Receptions: null,
  Targets: null,
  ReceivingYards: null,
  ReceivingTouchdowns: null,
  FantasyPoints: 28.4,
  FantasyPointsPPR: 28.4,
};

const BASE_WR: Parameters<SportsdataAdapter["buildContent"]>[0] = {
  PlayerID: 2,
  Name: "Justin Jefferson",
  Team: "MIN",
  Position: "WR",
  Week: 5,
  Season: 2025,
  PassingYards: null,
  PassingTouchdowns: null,
  PassingInterceptions: null,
  RushingAttempts: null,
  RushingYards: null,
  RushingTouchdowns: null,
  Receptions: 8,
  Targets: 11,
  ReceivingYards: 134,
  ReceivingTouchdowns: 1,
  FantasyPoints: 24.4,
  FantasyPointsPPR: 32.4,
};

const BASE_RB: Parameters<SportsdataAdapter["buildContent"]>[0] = {
  PlayerID: 3,
  Name: "Saquon Barkley",
  Team: "PHI",
  Position: "RB",
  Week: 5,
  Season: 2025,
  PassingYards: null,
  PassingTouchdowns: null,
  PassingInterceptions: null,
  RushingAttempts: 20,
  RushingYards: 112,
  RushingTouchdowns: 1,
  Receptions: 3,
  Targets: 4,
  ReceivingYards: 18,
  ReceivingTouchdowns: 0,
  FantasyPoints: 22.0,
  FantasyPointsPPR: 25.0,
};

// ─── Unit: buildContent ───────────────────────────────────────────────────────

describe("SportsdataAdapter.buildContent", () => {
  const adapter = new SportsdataAdapter("test-key", {} as PrismaClient);

  it("formats a QB stat line with rush yards", () => {
    const result = adapter.buildContent(BASE_QB);
    expect(result).toBe(
      "Patrick Mahomes Week 5: 312 pass yds, 3 TD, 22 rush yds (28.4 PPR pts)"
    );
  });

  it("omits INT when 0", () => {
    const result = adapter.buildContent({ ...BASE_QB, PassingInterceptions: 0 });
    expect(result).not.toContain("INT");
  });

  it("includes INT when non-zero", () => {
    const result = adapter.buildContent({ ...BASE_QB, PassingInterceptions: 2 });
    expect(result).toContain("2 INT");
  });

  it("formats a WR stat line with receptions, yards, TD", () => {
    const result = adapter.buildContent(BASE_WR);
    expect(result).toBe(
      "Justin Jefferson Week 5: 8/11 rec, 134 yds, 1 TD (32.4 PPR pts)"
    );
  });

  it("formats an RB stat line with rush + receiving", () => {
    const result = adapter.buildContent(BASE_RB);
    expect(result).toBe(
      "Saquon Barkley Week 5: 112 rush yds, 1 rush TD, 3/4 rec, 18 yds (25.0 PPR pts)"
    );
  });

  it("falls back to 'stats available' when no position-specific stats are set", () => {
    const noStats = { ...BASE_QB, Position: "K", PassingYards: null, RushingYards: null };
    const result = adapter.buildContent(noStats);
    expect(result).toContain("stats available");
  });

  it("omits PPR suffix when FantasyPointsPPR is null", () => {
    const result = adapter.buildContent({ ...BASE_WR, FantasyPointsPPR: null });
    expect(result).not.toContain("PPR pts");
  });
});

// ─── Unit: hasFantasyRelevantStats ────────────────────────────────────────────

describe("SportsdataAdapter.hasFantasyRelevantStats", () => {
  const adapter = new SportsdataAdapter("test-key", {} as PrismaClient);
  const check = (p: Partial<typeof BASE_QB>) =>
    adapter.hasFantasyRelevantStats({ ...BASE_QB, ...p });

  it("accepts player with PPR >= 5", () => {
    expect(check({ FantasyPointsPPR: 5 })).toBe(true);
    expect(check({ FantasyPointsPPR: 28.4 })).toBe(true);
  });

  it("rejects player with PPR < 5", () => {
    expect(check({ FantasyPointsPPR: 4.9 })).toBe(false);
    expect(check({ FantasyPointsPPR: 0 })).toBe(false);
  });

  it("falls back to FantasyPoints when PPR is null", () => {
    expect(check({ FantasyPointsPPR: null, FantasyPoints: 6 })).toBe(true);
    expect(check({ FantasyPointsPPR: null, FantasyPoints: 4 })).toBe(false);
  });

  it("rejects when both fantasy point fields are null", () => {
    expect(check({ FantasyPointsPPR: null, FantasyPoints: null })).toBe(false);
  });
});

// ─── Unit: fetchSignals (mocked fetch + prisma) ──────────────────────────────

function makePrisma(existingKeys: string[] = []) {
  return {
    signal: {
      findMany: vi.fn().mockResolvedValue(
        existingKeys.map((k) => ({ metadata: { dedupeKey: k } }))
      ),
    },
  } as unknown as PrismaClient;
}

function mockFetch(season: number | null, week: number | null, stats: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("CurrentSeason")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(season) });
      }
      if (url.includes("CurrentWeek")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(week) });
      }
      if (url.includes("PlayerGameStatsByWeek")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(stats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    })
  );
}

describe("SportsdataAdapter.fetchSignals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns empty array during offseason (week 0)", async () => {
    mockFetch(2025, 0);
    const adapter = new SportsdataAdapter("key", makePrisma());
    expect(await adapter.fetchSignals()).toHaveLength(0);
  });

  it("returns empty array when week is null", async () => {
    mockFetch(2025, null);
    const adapter = new SportsdataAdapter("key", makePrisma());
    expect(await adapter.fetchSignals()).toHaveLength(0);
  });

  it("returns empty array when week > 18 (postseason not modeled)", async () => {
    mockFetch(2025, 19);
    const adapter = new SportsdataAdapter("key", makePrisma());
    expect(await adapter.fetchSignals()).toHaveLength(0);
  });

  it("emits signals for players above fantasy point threshold", async () => {
    mockFetch(2025, 5, [BASE_QB, BASE_WR]);
    const adapter = new SportsdataAdapter("key", makePrisma());
    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(2);
    expect(signals[0].rawPlayerName).toBe("Patrick Mahomes");
    expect(signals[0].source).toBe("SPORTSDATA");
    expect(signals[0].signalType).toBe("STATS_UPDATE");
    expect(signals[0].metadata?.week).toBe(5);
    expect(signals[0].metadata?.season).toBe(2025);
  });

  it("skips players below fantasy point threshold", async () => {
    const lowScorer = { ...BASE_WR, Name: "Practice Squad Guy", FantasyPointsPPR: 1.0 };
    mockFetch(2025, 5, [BASE_QB, lowScorer]);
    const adapter = new SportsdataAdapter("key", makePrisma());
    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].rawPlayerName).toBe("Patrick Mahomes");
  });

  it("deduplicates players already seen this week", async () => {
    const existingKey = `${BASE_QB.PlayerID}:2025:5`;
    mockFetch(2025, 5, [BASE_QB, BASE_WR]);
    const adapter = new SportsdataAdapter("key", makePrisma([existingKey]));
    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].rawPlayerName).toBe("Justin Jefferson");
  });

  it("throws when CurrentSeason fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );
    const adapter = new SportsdataAdapter("bad-key", makePrisma());
    await expect(adapter.fetchSignals()).rejects.toThrow("SportsDataIO fetch failed: 401");
  });
});
