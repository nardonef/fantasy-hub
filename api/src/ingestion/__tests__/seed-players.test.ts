import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../lib/prisma";

// ─── Unit: player filtering logic (mirrors seed-players.ts) ──────────────────

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

function isEligible(p: {
  full_name?: string;
  active?: boolean;
  fantasy_positions?: string[];
  position?: string;
}): boolean {
  if (!p.full_name) return false;
  if (!p.active) return false;
  const positions = p.fantasy_positions ?? (p.position ? [p.position] : []);
  return positions.some((pos) => FANTASY_POSITIONS.has(pos));
}

describe("seed player eligibility filter", () => {
  it("accepts an active QB", () => {
    expect(isEligible({ full_name: "Patrick Mahomes", active: true, fantasy_positions: ["QB"] })).toBe(true);
  });

  it("rejects an inactive player", () => {
    expect(isEligible({ full_name: "Retired Guy", active: false, fantasy_positions: ["RB"] })).toBe(false);
  });

  it("rejects a player with no name", () => {
    expect(isEligible({ active: true, fantasy_positions: ["WR"] })).toBe(false);
  });

  it("rejects a non-fantasy position (OL)", () => {
    expect(isEligible({ full_name: "Some Lineman", active: true, fantasy_positions: ["OL"] })).toBe(false);
  });

  it("accepts a player whose position comes from `position` field when `fantasy_positions` is absent", () => {
    expect(isEligible({ full_name: "Kicker Guy", active: true, position: "K" })).toBe(true);
  });

  it("rejects a player with no position data at all", () => {
    expect(isEligible({ full_name: "Mystery Player", active: true })).toBe(false);
  });
});

// ─── Integration: DB state after seeding ─────────────────────────────────────

describe("players table after seed (integration)", () => {
  it("has at least 2000 rows", async () => {
    const count = await prisma.player.count();
    expect(count).toBeGreaterThanOrEqual(2000);
  });

  it("contains Patrick Mahomes", async () => {
    const player = await prisma.player.findUnique({
      where: { fullName: "Patrick Mahomes" },
    });
    expect(player).not.toBeNull();
    expect(player?.position).toBe("QB");
    expect(player?.nflTeam).toBe("KC");
  });

  it("all rows have a non-empty fullName", async () => {
    const empty = await prisma.player.count({
      where: { fullName: "" },
    });
    expect(empty).toBe(0);
  });

  it("all rows have a known fantasy position or null", async () => {
    // Prisma doesn't support null in notIn for string fields — check non-null
    // rows separately: find any row where position is set but not a valid value
    const invalidPositions = await prisma.player.findMany({
      where: {
        position: { not: null },
        AND: { position: { notIn: ["QB", "RB", "WR", "TE", "K", "DEF"] } },
      },
      select: { fullName: true, position: true },
      take: 5,
    });
    expect(invalidPositions).toHaveLength(0);
  });

  it("is idempotent — re-seeding does not change the row count", async () => {
    const before = await prisma.player.count();

    // Re-upsert a known player (simulates re-running the seed)
    await prisma.player.upsert({
      where: { fullName: "Patrick Mahomes" },
      create: { fullName: "Patrick Mahomes", position: "QB", nflTeam: "KC" },
      update: { position: "QB", nflTeam: "KC" },
    });

    const after = await prisma.player.count();
    expect(after).toBe(before);
  });
});
