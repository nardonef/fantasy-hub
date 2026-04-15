import { describe, it, expect, vi, beforeEach } from "vitest";
import { sleeperAdapter } from "../sleeper";

// Mock global fetch — all tests drive behaviour through this mock
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function sleeperResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

// Minimal roster factory helpers
function roster(
  owner_id: string | null,
  players: string[],
  starters: string[],
  reserve: string[] = [],
  taxi: string[] = []
) {
  return { roster_id: 1, owner_id, players, starters, reserve, taxi, settings: { wins: 0, losses: 0, ties: 0, fpts: 0 } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sleeperAdapter.getCurrentRoster", () => {
  it("assigns STARTER slot to players in the starters array", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        roster("owner-1", ["player-a", "player-b"], ["player-a", "player-b"]),
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ managerProviderManagerId: "owner-1", providerPlayerId: "player-a", slot: "STARTER" });
    expect(result[1]).toMatchObject({ managerProviderManagerId: "owner-1", providerPlayerId: "player-b", slot: "STARTER" });
  });

  it("assigns IR slot to players in the reserve array", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        roster("owner-1", ["player-ir"], [], ["player-ir"]),
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ providerPlayerId: "player-ir", slot: "IR" });
  });

  it("assigns TAXI slot to players in the taxi array", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        roster("owner-1", ["player-taxi"], [], [], ["player-taxi"]),
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ providerPlayerId: "player-taxi", slot: "TAXI" });
  });

  it("assigns BENCH slot to players not in starters, reserve, or taxi", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        roster("owner-1", ["player-bench"], []),
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ providerPlayerId: "player-bench", slot: "BENCH" });
  });

  it("correctly assigns mixed slots across a single roster", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        roster(
          "owner-1",
          ["s1", "s2", "bench1", "ir1", "taxi1"],
          ["s1", "s2"],
          ["ir1"],
          ["taxi1"]
        ),
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");
    const byId = Object.fromEntries(result.map((r) => [r.providerPlayerId, r.slot]));

    expect(byId["s1"]).toBe("STARTER");
    expect(byId["s2"]).toBe("STARTER");
    expect(byId["bench1"]).toBe("BENCH");
    expect(byId["ir1"]).toBe("IR");
    expect(byId["taxi1"]).toBe("TAXI");
  });

  it("skips roster slots where owner_id is null (orphaned slots)", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        { ...roster(null, ["player-x"], ["player-x"]), owner_id: null },
        roster("owner-2", ["player-y"], ["player-y"]),
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toHaveLength(1);
    expect(result[0].managerProviderManagerId).toBe("owner-2");
  });

  it("handles rosters with null players array gracefully (no crash)", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        { roster_id: 1, owner_id: "owner-1", players: null, starters: null, reserve: null, taxi: null, settings: { wins: 0, losses: 0, ties: 0, fpts: 0 } },
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toHaveLength(0);
  });

  it("returns an empty array when the league has no rosters", async () => {
    mockFetch.mockReturnValueOnce(sleeperResponse([]));

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toEqual([]);
  });

  it("returns players from multiple rosters with correct owner IDs", async () => {
    mockFetch.mockReturnValueOnce(
      sleeperResponse([
        roster("owner-1", ["p1"], ["p1"]),
        roster("owner-2", ["p2", "p3"], [], ["p2"]),
      ])
    );

    const result = await sleeperAdapter.getCurrentRoster!({}, "league-1");

    expect(result).toHaveLength(3);
    const owner1 = result.filter((r) => r.managerProviderManagerId === "owner-1");
    const owner2 = result.filter((r) => r.managerProviderManagerId === "owner-2");
    expect(owner1).toHaveLength(1);
    expect(owner2).toHaveLength(2);
  });

  it("calls the correct Sleeper endpoint", async () => {
    mockFetch.mockReturnValueOnce(sleeperResponse([]));

    await sleeperAdapter.getCurrentRoster!({}, "league-xyz");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.sleeper.app/v1/league/league-xyz/rosters"
    );
  });
});
