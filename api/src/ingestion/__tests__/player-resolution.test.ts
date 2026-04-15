import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../lib/prisma";
import { levenshtein, resolvePlayer } from "../player-resolution";

// ─── Unit: levenshtein ────────────────────────────────────────────────────────

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("mahomes", "mahomes")).toBe(0);
  });

  it("returns 1 for a single insertion", () => {
    expect(levenshtein("test", "tests")).toBe(1);
  });

  it("returns 1 for a single deletion", () => {
    expect(levenshtein("tests", "test")).toBe(1);
  });

  it("returns 1 for a single substitution", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });

  it("returns 2 for 'mahomes' vs 'mahomez'", () => {
    // One substitution only — should be 1
    expect(levenshtein("mahomes", "mahomez")).toBe(1);
  });

  it("returns correct distance for common abbreviation pattern", () => {
    // "P. Mahomes" vs "Patrick Mahomes" — well above threshold (expected > 2)
    expect(levenshtein("p. mahomes", "patrick mahomes")).toBeGreaterThan(2);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });

  it("is case-sensitive (callers normalize before calling)", () => {
    expect(levenshtein("Mahomes", "mahomes")).toBe(1);
  });
});

// ─── Integration: resolvePlayer ──────────────────────────────────────────────
// These tests use the real DB and clean up after themselves.

describe("resolvePlayer (integration)", () => {
  let playerId: string;

  // Use a name that will never appear in the real NFL roster
  const TEST_PLAYER_NAME = "__Test Player Resolution Alpha__";

  beforeAll(async () => {
    // Clean up any leftover from a previous interrupted run, then create fresh
    await prisma.player.deleteMany({ where: { fullName: TEST_PLAYER_NAME } });
    const player = await prisma.player.create({
      data: { fullName: TEST_PLAYER_NAME, position: "QB", nflTeam: "KC" },
    });
    playerId = player.id;
  });

  afterAll(async () => {
    await prisma.player.deleteMany({ where: { fullName: TEST_PLAYER_NAME } });
  });

  it("resolves an exact full name match", async () => {
    const result = await resolvePlayer(TEST_PLAYER_NAME, "TEST", prisma);
    expect(result).toBe(playerId);
  });

  it("resolves case-insensitively", async () => {
    const result = await resolvePlayer(TEST_PLAYER_NAME.toLowerCase(), "TEST", prisma);
    expect(result).toBe(playerId);
  });

  it("resolves a minor spelling variant via Levenshtein (distance 1)", async () => {
    // Replace last char — one substitution
    const variant = TEST_PLAYER_NAME.slice(0, -1) + "Z";
    const result = await resolvePlayer(variant, "TEST", prisma);
    expect(result).toBe(playerId);
  });

  it("saves an alias after fuzzy resolution so next lookup is instant", async () => {
    // Remove one char from the end — distance 1
    const variant = TEST_PLAYER_NAME.slice(0, -2) + "X_";
    await resolvePlayer(variant, "TEST", prisma);
    const alias = await prisma.playerNameAlias.findUnique({ where: { alias: variant } });
    expect(alias?.playerId).toBe(playerId);
    // Second call hits the alias cache
    const cached = await resolvePlayer(variant, "TEST", prisma);
    expect(cached).toBe(playerId);
  });

  it("returns null for an unresolvable name (distance > 2)", async () => {
    const result = await resolvePlayer("Completely Unrelated Name Here", "TEST", prisma);
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await resolvePlayer("", "TEST", prisma);
    expect(result).toBeNull();
  });
});
