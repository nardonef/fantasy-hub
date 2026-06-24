import { describe, it, expect, vi, beforeEach } from "vitest";
import { FantasyProsAdapter } from "../fantasypros";
import type { PrismaClient } from "../../../generated/prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHtml(jsonBody: string): string {
  return `<html><script>var ecrData = ${jsonBody};\n    var sosData = [];\n</script></html>`;
}

const MINIMAL_PLAYER = {
  player_id: 1,
  player_name: "Patrick Mahomes",
  player_team_id: "KC",
  player_position_id: "QB",
  rank_ecr: 1,
  pos_rank: "QB1",
  player_ecr_delta: null as number | null,
};

// A player with a delta large enough to cross the critical threshold (>= 10).
const MOVING_PLAYER = { ...MINIMAL_PLAYER, player_ecr_delta: 12 };

function buildMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    player: {
      findMany: vi.fn().mockResolvedValue([
        { id: "player-1", fullName: "Patrick Mahomes" },
      ]),
    },
    playerRankingSnapshot: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    signal: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

// ─── Unit: parseEcrData ───────────────────────────────────────────────────────

describe("FantasyProsAdapter.parseEcrData", () => {
  const adapter = new FantasyProsAdapter({} as PrismaClient);

  it("parses valid HTML with trailing semicolon and subsequent vars", () => {
    const data = { players: [MINIMAL_PLAYER], last_updated: "2026-04-10" };
    const result = adapter.parseEcrData(buildHtml(JSON.stringify(data)));
    expect(result.players).toHaveLength(1);
    expect(result.players[0].player_name).toBe("Patrick Mahomes");
    expect(result.last_updated).toBe("2026-04-10");
  });

  it("throws when ecrData marker is absent", () => {
    expect(() => adapter.parseEcrData("<html><script>var other = {};</script></html>")).toThrow(
      "ecrData variable not found"
    );
  });

  it("parses multiple players", () => {
    const p2 = { ...MINIMAL_PLAYER, player_id: 2, player_name: "Justin Jefferson", rank_ecr: 10, pos_rank: "WR1" };
    const data = { players: [MINIMAL_PLAYER, p2], last_updated: "2026-04-10" };
    const result = adapter.parseEcrData(buildHtml(JSON.stringify(data)));
    expect(result.players).toHaveLength(2);
    expect(result.players[1].player_name).toBe("Justin Jefferson");
  });

  it("handles players with non-null ecr_delta", () => {
    const player = { ...MINIMAL_PLAYER, player_ecr_delta: 3 };
    const data = { players: [player], last_updated: "2026-04-10" };
    const result = adapter.parseEcrData(buildHtml(JSON.stringify(data)));
    expect(result.players[0].player_ecr_delta).toBe(3);
  });
});

// ─── Unit: buildContent ───────────────────────────────────────────────────────

describe("FantasyProsAdapter.buildContent", () => {
  const adapter = new FantasyProsAdapter({} as PrismaClient);

  it("formats player with positive delta (rise)", () => {
    const result = adapter.buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: 2 });
    expect(result).toBe("Patrick Mahomes ↑2 to QB1 (overall #1)");
  });

  it("formats player with negative delta (drop)", () => {
    const result = adapter.buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: -3 });
    expect(result).toBe("Patrick Mahomes ↓3 to QB1 (overall #1)");
  });

  it("formats large critical rise correctly", () => {
    const result = adapter.buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: 15 });
    expect(result).toBe("Patrick Mahomes ↑15 to QB1 (overall #1)");
  });

  it("formats large critical drop correctly", () => {
    const result = adapter.buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: -10 });
    expect(result).toBe("Patrick Mahomes ↓10 to QB1 (overall #1)");
  });
});

// ─── Unit: threshold filtering ────────────────────────────────────────────────

describe("FantasyProsAdapter threshold filtering", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not emit signal when delta is null", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);
    const ecrPayload = JSON.stringify({ players: [MINIMAL_PLAYER], last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0);
  });

  it("does not emit signal when |delta| < 10", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);
    const smallMove = { ...MINIMAL_PLAYER, player_ecr_delta: 5 };
    const ecrPayload = JSON.stringify({ players: [smallMove], last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0);
  });

  it("does not emit signal when |delta| = 9 (just below threshold)", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);
    const borderMove = { ...MINIMAL_PLAYER, player_ecr_delta: 9 };
    const ecrPayload = JSON.stringify({ players: [borderMove], last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0);
  });

  it("emits signal when |delta| >= 10", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);
    const ecrPayload = JSON.stringify({ players: [MOVING_PLAYER], last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].rawPlayerName).toBe("Patrick Mahomes");
    expect(signals[0].signalType).toBe("RANKING_CHANGE");
    expect(signals[0].metadata?.rankDelta).toBe(12);
  });

  it("emits signal when delta is exactly -10", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);
    const bigDrop = { ...MINIMAL_PLAYER, player_ecr_delta: -10 };
    const ecrPayload = JSON.stringify({ players: [bigDrop], last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].metadata?.rankDelta).toBe(-10);
  });
});

// ─── Unit: upsertSnapshots called for all players ────────────────────────────

describe("FantasyProsAdapter snapshot upsert", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("upserts snapshots for all players regardless of delta", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);

    // Two players: one below threshold, one above
    const players = [
      { ...MINIMAL_PLAYER, player_ecr_delta: 3 },
      { ...MINIMAL_PLAYER, player_id: 2, player_name: "Justin Jefferson", rank_ecr: 5, pos_rank: "WR1", player_ecr_delta: 15 },
    ];
    (mockPrisma.player.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "player-1", fullName: "Patrick Mahomes" },
      { id: "player-2", fullName: "Justin Jefferson" },
    ]);

    const ecrPayload = JSON.stringify({ players, last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    await adapter.fetchSignals();

    // Both players should have snapshots upserted
    expect(mockPrisma.playerRankingSnapshot.upsert).toHaveBeenCalledTimes(2);
  });

  it("only emits signal for the player crossing the threshold", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);

    const players = [
      { ...MINIMAL_PLAYER, player_ecr_delta: 3 },                          // below threshold
      { ...MINIMAL_PLAYER, player_id: 2, player_name: "Justin Jefferson", rank_ecr: 5, pos_rank: "WR1", player_ecr_delta: 15 }, // above threshold
    ];
    (mockPrisma.player.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "player-1", fullName: "Patrick Mahomes" },
      { id: "player-2", fullName: "Justin Jefferson" },
    ]);

    const ecrPayload = JSON.stringify({ players, last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].rawPlayerName).toBe("Justin Jefferson");
  });
});

// ─── Unit: deduplication ────────────────────────────────────────────────────

describe("FantasyProsAdapter.fetchSignals deduplication", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("skips players whose dedupeKey already exists in DB", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const existingKey = `${MOVING_PLAYER.player_id}:${today}`;

    const mockPrisma = buildMockPrisma({
      signal: {
        findMany: vi.fn().mockResolvedValue([{ metadata: { dedupeKey: existingKey } }]),
      },
    });

    const adapter = new FantasyProsAdapter(mockPrisma);
    const ecrPayload = JSON.stringify({ players: [MOVING_PLAYER], last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0);
  });

  it("emits signal when dedupeKey is new and delta crosses threshold", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);

    const ecrPayload = JSON.stringify({ players: [MOVING_PLAYER], last_updated: "2026-04-10" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(buildHtml(ecrPayload)) }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].rawPlayerName).toBe("Patrick Mahomes");
    expect(signals[0].source).toBe("FANTASYPROS");
    expect(signals[0].signalType).toBe("RANKING_CHANGE");
    expect(signals[0].metadata?.rankEcr).toBe(1);
    expect(signals[0].metadata?.posRank).toBe("QB1");
    expect(signals[0].metadata?.rankDelta).toBe(12);
  });

  it("throws when fetch response is not ok", async () => {
    const mockPrisma = buildMockPrisma();
    const adapter = new FantasyProsAdapter(mockPrisma);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(adapter.fetchSignals()).rejects.toThrow("FantasyPros fetch failed: 403");
  });
});
