import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient, Signal } from "../../generated/prisma/client";
import { generateCards } from "../card-generator";

// ─── Mock roster.ts ──────────────────────────────────────────────────────────

vi.mock("../../lib/roster", () => ({
  getRosterPlayerIds: vi.fn(),
}));

import { getRosterPlayerIds } from "../../lib/roster";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-04-15T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

function makeDBSignal(
  id: string,
  playerId: string,
  player: { id: string; fullName: string; position: string | null; nflTeam: string | null },
  overrides: Partial<Signal> = {}
): Signal & { player: typeof player } {
  return {
    id,
    playerId,
    source: "REDDIT",
    signalType: "SOCIAL_MENTION",
    content: "Some signal",
    metadata: null,
    publishedAt: hoursAgo(2),
    fetchedAt: hoursAgo(1),
    ...overrides,
    player,
  };
}

// Minimal Prisma mock — only the methods used by card-generator
function makePrisma(
  signals: (Signal & { player: { id: string; fullName: string; position: string | null; nflTeam: string | null } })[]
): Pick<PrismaClient, "signal" | "manager" | "season" | "matchup" | "rosterPlayer"> {
  return {
    signal: {
      findMany: vi.fn().mockResolvedValue(signals),
    },
    manager: { findFirst: vi.fn().mockResolvedValue(null) },
    season: { findFirst: vi.fn().mockResolvedValue(null) },
    matchup: { findFirst: vi.fn().mockResolvedValue(null) },
    rosterPlayer: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generateCards", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns empty array when user has no roster", async () => {
    vi.mocked(getRosterPlayerIds).mockResolvedValue(null);
    const prisma = makePrisma([]);
    const cards = await generateCards("league-1", "user-1", prisma as any);
    expect(cards).toHaveLength(0);
  });

  it("returns empty array when roster is empty", async () => {
    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set());
    const prisma = makePrisma([]);
    const cards = await generateCards("league-1", "user-1", prisma as any);
    expect(cards).toHaveLength(0);
  });

  it("generates INJURY_NEWS card for rostered player with injury keyword", async () => {
    const player = { id: "p1", fullName: "Tyreek Hill", position: "WR", nflTeam: "MIA" };
    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set(["p1"]));

    const signal = makeDBSignal("s1", "p1", player, {
      content: "Tyreek Hill is questionable with a hamstring injury",
      publishedAt: hoursAgo(3),
      source: "TWITTER",
    });
    const prisma = makePrisma([signal]);

    const cards = await generateCards("league-1", "user-1", prisma as any);
    const injuryCard = cards.find((c) => c.type === "INJURY_NEWS");
    expect(injuryCard).toBeDefined();
    expect(injuryCard?.headline).toContain("Tyreek Hill");
    expect(injuryCard?.players[0].id).toBe("p1");
  });

  it("generates RANKING_SHIFT card for rostered player with large ECR move", async () => {
    const player = { id: "p2", fullName: "CeeDee Lamb", position: "WR", nflTeam: "DAL" };
    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set(["p2"]));

    const signal = makeDBSignal("s2", "p2", player, {
      source: "FANTASYPROS",
      signalType: "RANKING_CHANGE",
      content: "↑7 to WR1",
      publishedAt: hoursAgo(12),
      metadata: { rankDelta: 7 },
    });
    const prisma = makePrisma([signal]);

    const cards = await generateCards("league-1", "user-1", prisma as any);
    const rankCard = cards.find((c) => c.type === "RANKING_SHIFT");
    expect(rankCard).toBeDefined();
    expect(rankCard?.headline).toContain("CeeDee Lamb");
    expect(rankCard?.headline).toContain("up");
  });

  it("generates WAIVER_ALERT only for players NOT on the roster", async () => {
    const rostered = { id: "p1", fullName: "Justin Jefferson", position: "WR", nflTeam: "MIN" };
    const unrostered = { id: "p2", fullName: "Jaylen Warren", position: "RB", nflTeam: "PIT" };

    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set(["p1"]));

    // Rostered player has 3 signals — should NOT become WAIVER_ALERT
    // Unrostered player has 4 signals — should become WAIVER_ALERT
    const signals = [
      makeDBSignal("s1", "p1", rostered, { publishedAt: hoursAgo(10) }),
      makeDBSignal("s2", "p1", rostered, { publishedAt: hoursAgo(20) }),
      makeDBSignal("s3", "p1", rostered, { publishedAt: hoursAgo(30) }),
      makeDBSignal("s4", "p2", unrostered, { publishedAt: hoursAgo(5) }),
      makeDBSignal("s5", "p2", unrostered, { publishedAt: hoursAgo(10) }),
      makeDBSignal("s6", "p2", unrostered, { publishedAt: hoursAgo(15) }),
      makeDBSignal("s7", "p2", unrostered, { publishedAt: hoursAgo(20) }),
    ];
    const prisma = makePrisma(signals);

    const cards = await generateCards("league-1", "user-1", prisma as any);
    const waiverCards = cards.filter((c) => c.type === "WAIVER_ALERT");

    expect(waiverCards.length).toBeGreaterThan(0);
    // Rostered player must not appear in waiver cards
    const waiverPlayerIds = waiverCards.flatMap((c) => c.players.map((p) => p.id));
    expect(waiverPlayerIds).not.toContain("p1");
    expect(waiverPlayerIds).toContain("p2");
  });

  it("generates START_SIT card when two same-position rostered players diverge in confidence", async () => {
    const strong = { id: "p1", fullName: "Drake London", position: "WR", nflTeam: "ATL" };
    const weak = { id: "p2", fullName: "Jaylen Waddle", position: "WR", nflTeam: "MIA" };

    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set(["p1", "p2"]));

    const signals = [
      // p1: 3 distinct sources → confidence 3
      makeDBSignal("s1", "p1", strong, { source: "REDDIT", publishedAt: hoursAgo(2) }),
      makeDBSignal("s2", "p1", strong, { source: "FANTASYPROS", publishedAt: hoursAgo(4) }),
      makeDBSignal("s3", "p1", strong, { source: "SPORTSDATA", publishedAt: hoursAgo(6) }),
      // p2: 1 source → confidence 1
      makeDBSignal("s4", "p2", weak, { source: "REDDIT", publishedAt: hoursAgo(5) }),
    ];
    const prisma = makePrisma(signals);

    const cards = await generateCards("league-1", "user-1", prisma as any);
    const startSitCard = cards.find((c) => c.type === "START_SIT");

    expect(startSitCard).toBeDefined();
    expect(startSitCard?.headline).toContain("Drake London");
    expect(startSitCard?.headline).toContain("Jaylen Waddle");
    // Strong player should be recommended to start
    expect(startSitCard?.players[0].id).toBe("p1");
  });

  it("does not generate START_SIT when confidence gap is less than 2", async () => {
    const p1 = { id: "p1", fullName: "Player One", position: "RB", nflTeam: "KC" };
    const p2 = { id: "p2", fullName: "Player Two", position: "RB", nflTeam: "SF" };

    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set(["p1", "p2"]));

    const signals = [
      // p1: 2 sources → confidence 2
      makeDBSignal("s1", "p1", p1, { source: "REDDIT", publishedAt: hoursAgo(2) }),
      makeDBSignal("s2", "p1", p1, { source: "FANTASYPROS", publishedAt: hoursAgo(4) }),
      // p2: 1 source → confidence 1
      makeDBSignal("s3", "p2", p2, { source: "REDDIT", publishedAt: hoursAgo(3) }),
    ];
    const prisma = makePrisma(signals);

    const cards = await generateCards("league-1", "user-1", prisma as any);
    expect(cards.find((c) => c.type === "START_SIT")).toBeUndefined();
  });

  it("caps action items at 5", async () => {
    // Build many rostered players each with injury signals
    const players = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      fullName: `Player ${i}`,
      position: "WR",
      nflTeam: "KC",
    }));

    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set(players.map((p) => p.id)));

    const signals = players.flatMap((player) => [
      makeDBSignal(`s-${player.id}`, player.id, player, {
        content: "Player is questionable (hamstring)",
        publishedAt: hoursAgo(2),
      }),
    ]);
    const prisma = makePrisma(signals);

    const cards = await generateCards("league-1", "user-1", prisma as any);
    expect(cards.length).toBeLessThanOrEqual(5);
  });

  it("orders cards with INJURY_NEWS first", async () => {
    const player1 = { id: "p1", fullName: "Injured Player", position: "WR", nflTeam: "KC" };
    const player2 = { id: "p2", fullName: "Waiver Player", position: "RB", nflTeam: "SF" };

    vi.mocked(getRosterPlayerIds).mockResolvedValue(new Set(["p1"]));

    const signals = [
      makeDBSignal("s1", "p1", player1, {
        content: "Player ruled out this week",
        publishedAt: hoursAgo(2),
      }),
      makeDBSignal("s2", "p2", player2, { publishedAt: hoursAgo(1) }),
      makeDBSignal("s3", "p2", player2, { publishedAt: hoursAgo(2) }),
      makeDBSignal("s4", "p2", player2, { publishedAt: hoursAgo(3) }),
    ];
    const prisma = makePrisma(signals);

    const cards = await generateCards("league-1", "user-1", prisma as any);
    if (cards.length >= 2) {
      expect(cards[0].type).toBe("INJURY_NEWS");
    }
  });
});
