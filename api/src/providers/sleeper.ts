import type {
  ProviderAdapter,
  ProviderLeague,
  ProviderSeasonData,
  ProviderManager,
  ProviderMatchup,
  ProviderDraftPick,
} from "./types";

const SLEEPER_API = "https://api.sleeper.app/v1";

class SleeperAPIError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "SleeperAPIError";
  }
}

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER_API}${path}`);
  if (!res.ok) throw new SleeperAPIError(`Sleeper API error: ${res.status} ${path}`, res.status);
  return res.json() as Promise<T>;
}

interface SleeperLeague {
  league_id: string;
  name: string;
  scoring_settings: Record<string, number>;
  total_rosters: number;
  season: string;
  previous_league_id: string | null;
  status: string;
}

interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  settings: { wins: number; losses: number; ties: number; fpts: number; fpts_decimal?: number; fpts_against?: number; fpts_against_decimal?: number };
}

interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
}

interface SleeperDraftPick {
  round: number;
  pick_no: number;
  roster_id: number;
  metadata: { first_name?: string; last_name?: string; position?: string };
}

/**
 * Sleeper adapter — public API, no auth required.
 * Credentials only need { username } to look up the user.
 */
export const sleeperAdapter: ProviderAdapter = {
  async getLeagues(credentials): Promise<ProviderLeague[]> {
    const { username } = credentials;
    if (!username || typeof username !== "string" || username.trim() === "") {
      throw new SleeperAPIError("Sleeper username is required", 400);
    }
    const user = await sleeperFetch<{ user_id: string } | null>(`/user/${username}`);
    if (!user || !user.user_id) {
      throw new SleeperAPIError("Sleeper username not found", 404);
    }
    // Use current NFL season year: if before September, it's the previous year's season
    const now = new Date();
    const currentYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

    // Get the user's current-year leagues, then trace back through
    // previous_league_id to discover all historical seasons.
    const leagues = await sleeperFetch<SleeperLeague[]>(
      `/user/${user.user_id}/leagues/nfl/${currentYear}`
    );
    if (!leagues) return [];

    const result: ProviderLeague[] = [];

    for (const league of leagues) {
      const isPpr = (league.scoring_settings?.rec ?? 0) >= 1;
      const isHalfPpr =
        (league.scoring_settings?.rec ?? 0) > 0 &&
        (league.scoring_settings?.rec ?? 0) < 1;

      const seasons: number[] = [parseInt(league.season)];
      const seasonLeagueIds: Record<number, string> = {
        [parseInt(league.season)]: league.league_id,
      };

      // Follow previous_league_id chain to discover all historical seasons
      let prevId = league.previous_league_id;
      while (prevId) {
        const prevLeague = await sleeperFetch<SleeperLeague | null>(
          `/league/${prevId}`
        ).catch(() => null);
        if (!prevLeague) break;
        const prevYear = parseInt(prevLeague.season);
        if (!seasons.includes(prevYear)) {
          seasons.push(prevYear);
          seasonLeagueIds[prevYear] = prevLeague.league_id;
        }
        prevId = prevLeague.previous_league_id;
      }

      seasons.sort((a, b) => b - a);

      result.push({
        providerLeagueId: league.league_id,
        name: league.name,
        scoringType: isPpr ? "ppr" : isHalfPpr ? "half_ppr" : "standard",
        teamCount: league.total_rosters,
        seasons,
        seasonLeagueIds,
      });
    }

    return result;
  },

  async getSeasonData(credentials, leagueId, year): Promise<ProviderSeasonData> {
    // Fetch rosters, users, matchups, and draft for this league
    const [rosters, users, drafts] = await Promise.all([
      sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`),
      sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`),
      sleeperFetch<{ draft_id: string }[]>(`/league/${leagueId}/drafts`).catch(
        () => [] as { draft_id: string }[]
      ),
    ]);

    // Fetch draft picks using the draft ID (not the league ID)
    let draft: SleeperDraftPick[] = [];
    if (drafts.length > 0) {
      draft = await sleeperFetch<SleeperDraftPick[]>(
        `/draft/${drafts[0].draft_id}/picks`
      ).catch(() => [] as SleeperDraftPick[]);
    }

    // Map roster_id → user info
    const rosterToUser = new Map<number, SleeperUser>();
    const rosterToOwnerId = new Map<number, string>();
    for (const roster of rosters) {
      rosterToOwnerId.set(roster.roster_id, roster.owner_id);
      const user = users.find((u) => u.user_id === roster.owner_id);
      if (user) rosterToUser.set(roster.roster_id, user);
    }

    // Build managers
    const managers: ProviderManager[] = rosters.map((roster) => {
      const user = rosterToUser.get(roster.roster_id);
      return {
        providerManagerId: roster.owner_id,
        name: user?.display_name ?? `Team ${roster.roster_id}`,
        avatarUrl: user?.avatar
          ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
          : null,
        teamName: user?.display_name ?? `Team ${roster.roster_id}`,
      };
    });

    // Fetch matchups for all weeks (NFL regular season = 14-18 weeks)
    const matchups: ProviderMatchup[] = [];
    for (let week = 1; week <= 18; week++) {
      const weekMatchups = await sleeperFetch<SleeperMatchup[]>(
        `/league/${leagueId}/matchups/${week}`
      ).catch(() => [] as SleeperMatchup[]);

      if (!weekMatchups || weekMatchups.length === 0) break;

      // Group by matchup_id to pair opponents
      const grouped = new Map<number, SleeperMatchup[]>();
      for (const m of weekMatchups) {
        const group = grouped.get(m.matchup_id) ?? [];
        group.push(m);
        grouped.set(m.matchup_id, group);
      }

      for (const [, pair] of grouped) {
        if (pair.length === 2) {
          const homeOwnerId = rosterToOwnerId.get(pair[0].roster_id);
          const awayOwnerId = rosterToOwnerId.get(pair[1].roster_id);
          if (homeOwnerId && awayOwnerId) {
            matchups.push({
              week,
              matchupType: week <= 14 ? "REGULAR" : "PLAYOFF",
              homeManagerId: homeOwnerId,
              awayManagerId: awayOwnerId,
              homeScore: pair[0].points,
              awayScore: pair[1].points,
            });
          }
        }
      }
    }

    // Build draft picks
    const draftPicks: ProviderDraftPick[] = draft.map((pick) => ({
      round: pick.round,
      pickNumber: pick.pick_no,
      managerProviderManagerId:
        rosterToOwnerId.get(pick.roster_id) ?? String(pick.roster_id),
      playerName: `${pick.metadata?.first_name ?? ""} ${pick.metadata?.last_name ?? ""}`.trim(),
      position: pick.metadata?.position ?? null,
    }));

    // Build standings from roster settings
    const standings = rosters.map((roster) => ({
      managerProviderManagerId: roster.owner_id,
      rank: 0, // will be calculated after sorting
      wins: roster.settings.wins,
      losses: roster.settings.losses,
      ties: roster.settings.ties,
      pointsFor:
        roster.settings.fpts + (roster.settings.fpts_decimal ?? 0) / 100,
      pointsAgainst:
        (roster.settings.fpts_against ?? 0) +
        (roster.settings.fpts_against_decimal ?? 0) / 100,
    }));

    // Sort by wins desc, then points for desc, and assign ranks
    standings.sort(
      (a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor
    );
    standings.forEach((s, i) => (s.rank = i + 1));

    // Determine champion from the winners bracket (not regular-season record)
    let championManagerId: string | null = null;
    try {
      const bracket = await sleeperFetch<
        { r: number; m: number; t1: number; t2: number; w: number | null }[]
      >(`/league/${leagueId}/winners_bracket`);
      if (bracket && bracket.length > 0) {
        // Championship is the highest round, lowest match number
        const maxRound = Math.max(...bracket.map((b) => b.r));
        const championship = bracket.find((b) => b.r === maxRound && b.m === Math.min(
          ...bracket.filter((x) => x.r === maxRound).map((x) => x.m)
        ));
        if (championship?.w) {
          const winnerOwnerId = rosterToOwnerId.get(championship.w);
          if (winnerOwnerId) championManagerId = winnerOwnerId;
        }
      }
    } catch {
      // Bracket not available (season in progress) — fall back to standings leader
    }
    if (!championManagerId) {
      championManagerId = standings[0]?.managerProviderManagerId ?? null;
    }

    return {
      year,
      managers,
      matchups,
      draftPicks,
      transactions: [], // Sleeper transactions require separate endpoint, deferred
      standings,
      championManagerId,
    };
  },
};
