import { describe, it, expect, vi, beforeEach } from "vitest";
import { yahooAdapter } from "../yahoo";

// Mock global fetch — all tests drive behaviour through this mock
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function yahooResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

/**
 * Builds a minimal Yahoo teams;out=roster response.
 * Each team entry encodes a manager and a list of players with their slots.
 */
function buildRosterResponse(
  teams: Array<{
    managerNickname?: string;
    managerEmail?: string;
    managerId?: string;
    hidden?: boolean;
    players: Array<{ name: string; position: string }>;
  }>
) {
  const teamsWrapper: Record<string, unknown> = { count: teams.length };

  teams.forEach((team, i) => {
    const nickname = team.hidden ? "--hidden--" : (team.managerNickname ?? "TestManager");
    const slotId = team.managerId ?? String(i + 1);

    const managerObj = {
      manager_id: slotId,
      nickname,
      email: team.managerEmail ?? null,
      image_url: null,
    };

    const playersWrapper: Record<string, unknown> = { count: team.players.length };
    team.players.forEach((player, p) => {
      playersWrapper[String(p)] = {
        player: [
          // player[0] = metadata array
          [
            { player_key: `player.${p}` },
            { name: { full: player.name, ascii_first: player.name.split(" ")[0], ascii_last: player.name.split(" ")[1] ?? "" } },
          ],
          // player[1] = selected_position etc.
          {
            selected_position: [
              { coverage_type: "week", week: 14 },
              { position: player.position },
            ],
          },
        ],
      };
    });

    teamsWrapper[String(i)] = {
      team: [
        // team[0] = metadata array
        [
          { team_key: `nfl.l.123.t.${slotId}` },
          { name: `Team ${slotId}` },
          [{ managers: [{ manager: managerObj }] }],
        ],
        // team[1] = roster
        {
          roster: {
            players: playersWrapper,
          },
        },
      ],
    };
  });

  return {
    fantasy_content: {
      league: [
        { league_key: "nfl.l.123" },
        { teams: teamsWrapper },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("yahooAdapter.getCurrentRoster", () => {
  it("assigns STARTER slot for position-coded slots (QB, RB, WR, TE, K)", async () => {
    for (const pos of ["QB", "RB", "WR", "TE", "K", "DEF", "W/R"]) {
      vi.clearAllMocks();
      mockFetch.mockReturnValueOnce(
        yahooResponse(buildRosterResponse([
          { players: [{ name: "Test Player", position: pos }] },
        ]))
      );

      const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

      expect(result[0].slot).toBe("STARTER");
    }
  });

  it("assigns BENCH slot for BN position", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse(buildRosterResponse([
        { players: [{ name: "Bench Player", position: "BN" }] },
      ]))
    );

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ playerName: "Bench Player", slot: "BENCH" });
  });

  it("assigns IR slot for IR position", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse(buildRosterResponse([
        { players: [{ name: "Injured Player", position: "IR" }] },
      ]))
    );

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ playerName: "Injured Player", slot: "IR" });
  });

  it("uses lowercase nickname as manager identity key", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse(buildRosterResponse([
        { managerNickname: "FrankNardone", players: [{ name: "Patrick Mahomes", position: "QB" }] },
      ]))
    );

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result[0].managerProviderManagerId).toBe("franknardone");
  });

  it("uses email as identity key for hidden managers with email", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse(buildRosterResponse([
        { hidden: true, managerEmail: "mgr@example.com", players: [{ name: "Patrick Mahomes", position: "QB" }] },
      ]))
    );

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result[0].managerProviderManagerId).toBe("mgr@example.com");
  });

  it("uses anon-{slotId} fallback for hidden managers with no email", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse(buildRosterResponse([
        { hidden: true, managerId: "7", players: [{ name: "Patrick Mahomes", position: "QB" }] },
      ]))
    );

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result[0].managerProviderManagerId).toBe("anon-7");
  });

  it("returns players from multiple teams with correct identities", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse(buildRosterResponse([
        { managerNickname: "Alice", players: [{ name: "Player A", position: "QB" }, { name: "Player B", position: "BN" }] },
        { managerNickname: "Bob",   players: [{ name: "Player C", position: "IR" }] },
      ]))
    );

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result).toHaveLength(3);
    const alice = result.filter((r) => r.managerProviderManagerId === "alice");
    const bob   = result.filter((r) => r.managerProviderManagerId === "bob");
    expect(alice).toHaveLength(2);
    expect(bob).toHaveLength(1);
    expect(bob[0].slot).toBe("IR");
  });

  it("skips players with no name in the metadata", async () => {
    // Build a response where the name field is absent
    const resp = buildRosterResponse([
      { players: [{ name: "Real Player", position: "QB" }] },
    ]);
    // Corrupt the name entry of the first player
    const playerEntry = (resp.fantasy_content.league[1] as any).teams["0"].team[1].roster.players["0"];
    playerEntry.player[0] = [{ player_key: "player.0" }]; // remove name object

    mockFetch.mockReturnValueOnce(yahooResponse(resp));

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result).toHaveLength(0);
  });

  it("returns an empty array when teams wrapper is absent (malformed response)", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse({
        fantasy_content: { league: [{}, {}] },
      })
    );

    const result = await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1");

    expect(result).toEqual([]);
  });

  it("returns an empty array and does not throw when the API response is completely malformed", async () => {
    mockFetch.mockReturnValueOnce(yahooResponse({ garbage: true }));

    await expect(
      yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "league-1")
    ).resolves.toEqual([]);
  });

  it("throws when the OAuth token is expired (401 response)", async () => {
    mockFetch.mockReturnValueOnce(yahooResponse({}, 401));

    await expect(
      yahooAdapter.getCurrentRoster!({ accessToken: "expired-tok" }, "league-1")
    ).rejects.toThrow("Yahoo OAuth token expired");
  });

  it("calls the correct Yahoo endpoint with format=json", async () => {
    mockFetch.mockReturnValueOnce(
      yahooResponse(buildRosterResponse([]))
    );

    await yahooAdapter.getCurrentRoster!({ accessToken: "tok" }, "nfl.l.98765");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://fantasysports.yahooapis.com/fantasy/v2/league/nfl.l.98765/teams;out=roster?format=json",
      expect.objectContaining({ headers: { Authorization: "Bearer tok" } })
    );
  });
});
