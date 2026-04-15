import { describe, it, expect, vi, beforeEach } from "vitest";
import { FantasyProsAdapter } from "../fantasypros";
import type { PrismaClient } from "../../../generated/prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Real page structure: ecrData assignment ends with `};` followed by other vars
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

// ─── Unit: buildContent (via fetchSignals with mocked fetch) ──────────────────

describe("FantasyProsAdapter content formatting", () => {
  // Access private method via cast
  const adapter = new FantasyProsAdapter({} as PrismaClient);
  const buildContent = (adapter as unknown as { buildContent: (p: typeof MINIMAL_PLAYER) => string }).buildContent.bind(adapter);

  it("formats player with null delta (no movement)", () => {
    const result = buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: null });
    expect(result).toBe("Patrick Mahomes ranked QB1 (overall #1)");
  });

  it("formats player with positive delta (rise)", () => {
    const result = buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: 2 });
    expect(result).toBe("Patrick Mahomes ↑2 to QB1 (overall #1)");
  });

  it("formats player with negative delta (drop)", () => {
    const result = buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: -3 });
    expect(result).toBe("Patrick Mahomes ↓3 to QB1 (overall #1)");
  });

  it("formats delta of 0 as a drop (↓0)", () => {
    // delta 0: not > 0, so falls into the else branch — ↓0
    const result = buildContent({ ...MINIMAL_PLAYER, player_ecr_delta: 0 });
    expect(result).toBe("Patrick Mahomes ↓0 to QB1 (overall #1)");
  });
});

// ─── Unit: fetchSignals deduplication ────────────────────────────────────────

describe("FantasyProsAdapter.fetchSignals deduplication", () => {
  it("skips players whose dedupeKey already exists in DB", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const existingKey = `${MINIMAL_PLAYER.player_id}:${today}`;

    const mockPrisma = {
      signal: {
        findMany: vi.fn().mockResolvedValue([
          { metadata: { dedupeKey: existingKey } },
        ]),
      },
    } as unknown as PrismaClient;

    const adapter = new FantasyProsAdapter(mockPrisma);

    const ecrPayload = JSON.stringify({
      players: [MINIMAL_PLAYER],
      last_updated: "2026-04-10",
    });
    const mockHtml = buildHtml(ecrPayload);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0); // deduped out
  });

  it("emits a signal when dedupeKey is new", async () => {
    const mockPrisma = {
      signal: {
        findMany: vi.fn().mockResolvedValue([]), // no prior signals
      },
    } as unknown as PrismaClient;

    const adapter = new FantasyProsAdapter(mockPrisma);

    const ecrPayload = JSON.stringify({
      players: [MINIMAL_PLAYER],
      last_updated: "2026-04-10",
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildHtml(ecrPayload)),
    }));

    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(1);
    expect(signals[0].rawPlayerName).toBe("Patrick Mahomes");
    expect(signals[0].source).toBe("FANTASYPROS");
    expect(signals[0].signalType).toBe("RANKING_CHANGE");
    expect(signals[0].metadata?.rankEcr).toBe(1);
    expect(signals[0].metadata?.posRank).toBe("QB1");
  });

  it("throws when fetch response is not ok", async () => {
    const mockPrisma = {
      signal: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    const adapter = new FantasyProsAdapter(mockPrisma);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }));

    await expect(adapter.fetchSignals()).rejects.toThrow("FantasyPros fetch failed: 403");
  });
});
