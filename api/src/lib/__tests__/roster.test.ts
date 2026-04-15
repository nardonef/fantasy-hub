import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing roster.ts
vi.mock("../prisma", () => ({
  prisma: {
    manager: { findFirst: vi.fn() },
    rosterPlayer: { findMany: vi.fn() },
  },
}));

import { getRosterPlayerIds } from "../roster";
import { prisma } from "../prisma";

const mockManager = vi.mocked(prisma.manager.findFirst);
const mockRoster  = vi.mocked(prisma.rosterPlayer.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRosterPlayerIds", () => {
  it("returns null when user has no manager in the league", async () => {
    mockManager.mockResolvedValue(null);

    const result = await getRosterPlayerIds("league-1", "user-1");

    expect(result).toBeNull();
    expect(mockRoster).not.toHaveBeenCalled();
  });

  it("returns null when roster has not been synced yet (zero rows)", async () => {
    mockManager.mockResolvedValue({ id: "manager-1" } as any);
    mockRoster.mockResolvedValue([]);

    const result = await getRosterPlayerIds("league-1", "user-1");

    expect(result).toBeNull();
  });

  it("returns a Set of resolved player IDs when roster is populated", async () => {
    mockManager.mockResolvedValue({ id: "manager-1" } as any);
    mockRoster.mockResolvedValue([
      { playerId: "player-a" },
      { playerId: "player-b" },
      { playerId: "player-c" },
    ] as any);

    const result = await getRosterPlayerIds("league-1", "user-1");

    expect(result).toBeInstanceOf(Set);
    expect(result?.size).toBe(3);
    expect(result?.has("player-a")).toBe(true);
    expect(result?.has("player-c")).toBe(true);
  });

  it("returns an empty Set when roster rows exist but all playerIds are null (unresolved players)", async () => {
    // Roster was synced but no players could be resolved to our players table
    mockManager.mockResolvedValue({ id: "manager-1" } as any);
    mockRoster.mockResolvedValue([
      { playerId: null },
      { playerId: null },
    ] as any);

    const result = await getRosterPlayerIds("league-1", "user-1");

    // Must be an empty Set (not null) — roster was synced, just no resolvable players
    expect(result).toBeInstanceOf(Set);
    expect(result?.size).toBe(0);
  });

  it("filters out null playerIds and only returns resolved ones", async () => {
    mockManager.mockResolvedValue({ id: "manager-1" } as any);
    mockRoster.mockResolvedValue([
      { playerId: "player-a" },
      { playerId: null },          // unresolved (e.g. DST or suffix mismatch)
      { playerId: "player-b" },
      { playerId: null },
    ] as any);

    const result = await getRosterPlayerIds("league-1", "user-1");

    expect(result?.size).toBe(2);
    expect(result?.has("player-a")).toBe(true);
    expect(result?.has("player-b")).toBe(true);
  });

  it("queries with the correct leagueId and managerId", async () => {
    mockManager.mockResolvedValue({ id: "manager-xyz" } as any);
    mockRoster.mockResolvedValue([{ playerId: "player-1" }] as any);

    await getRosterPlayerIds("league-abc", "user-123");

    expect(mockManager).toHaveBeenCalledWith({
      where: { leagueId: "league-abc", userId: "user-123" },
      select: { id: true },
    });
    expect(mockRoster).toHaveBeenCalledWith({
      where: { leagueId: "league-abc", managerId: "manager-xyz" },
      select: { playerId: true },
    });
  });
});
