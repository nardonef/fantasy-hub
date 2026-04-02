import type {
  ProviderAdapter,
  ProviderLeague,
  ProviderSeasonData,
  ProviderManager,
  ProviderMatchup,
  ProviderDraftPick,
  ProviderTransaction,
} from "./types";

/**
 * Yahoo Fantasy adapter — requires OAuth 2.0 credentials.
 * Yahoo's API uses XML by default; we request JSON via format=json param.
 * All requests include ?format=json to get JSON responses.
 *
 * Credentials required: { accessToken: string }
 * The caller is responsible for refreshing expired OAuth tokens.
 */

const YAHOO_API = "https://fantasysports.yahooapis.com/fantasy/v2";

async function yahooFetch<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(`${YAHOO_API}${path}?format=json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    throw new Error("Yahoo OAuth token expired — refresh required");
  }
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

/**
 * Resolves a Yahoo team_key or numeric slot ID to a nickname-based identity key
 * using the slotToIdentity map built during manager parsing.
 */
function resolveSlotToIdentity(
  teamKeyOrSlot: string,
  slotToIdentity: Map<string, string>
): string {
  // If it's already a numeric slot, look it up directly
  if (/^\d+$/.test(teamKeyOrSlot)) {
    return slotToIdentity.get(teamKeyOrSlot) ?? teamKeyOrSlot;
  }

  // Extract team number from key like "nfl.l.123456.t.3"
  const parts = teamKeyOrSlot.split(".");
  const teamNum = parts[parts.length - 1];

  if (teamNum) {
    return slotToIdentity.get(teamNum) ?? teamKeyOrSlot;
  }

  return teamKeyOrSlot;
}

export const yahooAdapter: ProviderAdapter = {
  async getLeagues(credentials): Promise<ProviderLeague[]> {
    const { accessToken } = credentials;
    // game_codes=nfl returns ALL NFL games the user has played (every season)
    // vs game_keys=nfl which only returns the current season
    const data = await yahooFetch<any>(
      "/users;use_login=1/games;game_codes=nfl/leagues",
      accessToken
    );

    // Collect all league entries across all seasons
    const entries: { leagueKey: string; name: string; scoringType: string | null; teamCount: number; season: number }[] = [];
    try {
      const games =
        data.fantasy_content.users[0].user[1].games;
      for (const gameEntry of Object.values(games) as any[]) {
        if (typeof gameEntry !== "object" || !gameEntry.game) continue;
        const game = gameEntry.game;
        const gameLeagues = game[1]?.leagues;
        if (!gameLeagues) continue;

        for (const leagueEntry of Object.values(gameLeagues) as any[]) {
          if (typeof leagueEntry !== "object" || !leagueEntry.league)
            continue;
          const l = leagueEntry.league[0];
          entries.push({
            leagueKey: l.league_key,
            name: l.name,
            scoringType: l.scoring_type ?? null,
            teamCount: parseInt(l.num_teams, 10),
            season: parseInt(l.season, 10),
          });
        }
      }
    } catch {
      // Yahoo's nested JSON structure is fragile — log and return what we have
    }

    // Group by league name to collect seasons and build year→leagueKey map
    const grouped = new Map<string, ProviderLeague>();
    for (const entry of entries) {
      const existing = grouped.get(entry.name);
      if (existing) {
        existing.seasons.push(entry.season);
        existing.seasonLeagueIds![entry.season] = entry.leagueKey;
      } else {
        grouped.set(entry.name, {
          providerLeagueId: entry.leagueKey, // most recent will be overwritten below
          name: entry.name,
          scoringType: entry.scoringType,
          teamCount: entry.teamCount,
          seasons: [entry.season],
          seasonLeagueIds: { [entry.season]: entry.leagueKey },
        });
      }
    }

    // Sort seasons and use the most recent league key as the primary ID
    for (const league of grouped.values()) {
      league.seasons.sort((a, b) => b - a);
      const mostRecentYear = league.seasons[0];
      league.providerLeagueId = league.seasonLeagueIds![mostRecentYear];
    }

    return Array.from(grouped.values());
  },

  async getSeasonData(
    credentials,
    leagueId,
    year
  ): Promise<ProviderSeasonData> {
    const { accessToken } = credentials;

    // Fetch standings, draft results, and transactions in parallel
    const [standingsData, draftData, transactionsData] = await Promise.all([
      yahooFetch<any>(`/league/${leagueId}/standings`, accessToken),
      yahooFetch<any>(`/league/${leagueId}/draftresults`, accessToken).catch(
        () => null
      ),
      yahooFetch<any>(`/league/${leagueId}/transactions`, accessToken).catch(
        () => null
      ),
    ]);

    // ── Parse managers & standings from standings endpoint ──
    const managers: ProviderManager[] = [];
    const standings: ProviderSeasonData["standings"] = [];
    // Maps numeric slot ID → nickname-based identity key for cross-referencing
    const slotToIdentity = new Map<string, string>();

    try {
      const league = standingsData.fantasy_content.league;
      // league[0] = metadata, league[1] = standings wrapper
      const teamsWrapper = league[1]?.standings?.[0]?.teams;
      if (teamsWrapper) {
        const teamCount =
          typeof teamsWrapper.count === "number" ? teamsWrapper.count : 0;
        for (let i = 0; i < teamCount; i++) {
          const teamEntry = teamsWrapper[String(i)];
          if (!teamEntry?.team) continue;

          const teamInfo = teamEntry.team[0]; // array of metadata objects
          // Yahoo nests team_standings at varying indices — search for it
          let teamStandings: any = null;
          for (let idx = 1; idx < teamEntry.team.length; idx++) {
            if (teamEntry.team[idx]?.team_standings) {
              teamStandings = teamEntry.team[idx].team_standings;
              break;
            }
          }

          // Yahoo stores team metadata as an array of objects with different keys
          let teamKey = "";
          let teamName = "";
          let slotId = "";
          let managerNickname = "";
          let managerEmail = "";
          let avatarUrl: string | null = null;

          for (const item of teamInfo) {
            if (Array.isArray(item)) {
              // managers array is nested inside the team info array
              for (const sub of item) {
                if (sub?.managers) {
                  const mgr = sub.managers[0]?.manager;
                  if (mgr) {
                    slotId = String(mgr.manager_id);
                    managerNickname = mgr.nickname ?? "";
                    managerEmail = mgr.email ?? "";
                    avatarUrl = mgr.image_url ?? null;
                  }
                }
              }
            } else if (typeof item === "object" && item !== null) {
              if (item.team_key) teamKey = item.team_key;
              if (item.name) teamName = item.name;
              // Sometimes manager info is at top level
              if (item.managers) {
                const mgr = item.managers[0]?.manager;
                if (mgr) {
                  slotId = String(mgr.manager_id);
                  managerNickname = mgr.nickname ?? "";
                  managerEmail = mgr.email ?? "";
                  avatarUrl = mgr.image_url ?? null;
                }
              }
            }
          }

          // Use team_key as fallback for slotId if not found
          if (!slotId) slotId = teamKey;

          // Build identity key: nickname → email → anon fallback
          // Normalize to lowercase to avoid case-sensitivity splits
          const isHidden = !managerNickname || managerNickname === "--hidden--";
          let identityKey: string;
          if (!isHidden) {
            identityKey = managerNickname.toLowerCase();
          } else if (managerEmail) {
            identityKey = managerEmail.toLowerCase();
          } else {
            identityKey = `anon-${slotId}-${year}`;
          }

          // Display name (for the manager record's name field)
          const managerName = isHidden
            ? (teamName || managerEmail || `Manager ${slotId}`)
            : managerNickname;

          // Map numeric slot → identity key for translating matchups/drafts/transactions
          slotToIdentity.set(slotId, identityKey);

          managers.push({
            providerManagerId: identityKey,
            originalSlotId: slotId,
            name: managerName,
            avatarUrl,
            teamName: teamName || managerName,
          });

          const rank = teamStandings?.rank
            ? parseInt(String(teamStandings.rank), 10)
            : i + 1;
          const outcomeTotal = teamStandings?.outcome_totals;

          standings.push({
            managerProviderManagerId: identityKey,
            rank,
            wins: parseInt(String(outcomeTotal?.wins ?? "0"), 10),
            losses: parseInt(String(outcomeTotal?.losses ?? "0"), 10),
            ties: parseInt(String(outcomeTotal?.ties ?? "0"), 10),
            pointsFor: parseFloat(String(teamStandings?.points_for ?? "0")),
            pointsAgainst: parseFloat(String(teamStandings?.points_against ?? "0")),
          });
        }
      }
    } catch {
      // Yahoo's nested structure can vary — continue with what we have
    }

    // Sort standings by rank
    standings.sort((a, b) => a.rank - b.rank);

    // ── Fetch matchups for all weeks (NFL = up to 18 weeks) ──
    const matchups: ProviderMatchup[] = [];

    // Determine total weeks from league metadata if available
    let totalWeeks = 18;
    let startWeek = 1;
    let playoffStartWeek = 15;
    try {
      const leagueMeta = standingsData.fantasy_content.league[0];
      if (leagueMeta.end_week) {
        totalWeeks = parseInt(leagueMeta.end_week, 10);
      }
      startWeek = parseInt(leagueMeta.start_week ?? "1", 10);
      playoffStartWeek = parseInt(
        leagueMeta.playoff_start_week ?? leagueMeta.end_week ?? "15",
        10
      );
    } catch {
      // Use defaults
    }

    // Fetch matchups in batches to avoid rate limiting
    for (let week = startWeek; week <= totalWeeks; week++) {
      try {
        const scoreboardData = await yahooFetch<any>(
          `/league/${leagueId}/scoreboard;week=${week}`,
          accessToken
        );

        const league = scoreboardData.fantasy_content.league;
        // Yahoo scoreboard structure: league[1].scoreboard is an object with string keys
        const scoreboard = league[1]?.scoreboard;
        const matchupsWrapper = scoreboard?.["0"]?.matchups ?? scoreboard?.[0]?.matchups;
        if (!matchupsWrapper) continue;

        const matchupCount =
          typeof matchupsWrapper.count === "number" ? matchupsWrapper.count : 0;

        for (let m = 0; m < matchupCount; m++) {
          const matchupEntry = matchupsWrapper[String(m)];
          if (!matchupEntry?.matchup) continue;

          const matchup = matchupEntry.matchup;
          // Teams may be at matchup.teams or matchup['0'].teams (nested inside numbered key)
          const teams = matchup.teams ?? matchup["0"]?.teams;
          if (!teams) continue;

          // Determine matchup type
          let matchupType: ProviderMatchup["matchupType"] = "REGULAR";
          if (matchup.is_playoffs === "1" || week >= playoffStartWeek) {
            if (matchup.is_consolation === "1") {
              matchupType = "CONSOLATION";
            } else if (
              week === totalWeeks &&
              matchup.is_playoffs === "1"
            ) {
              matchupType = "CHAMPIONSHIP";
            } else {
              matchupType = "PLAYOFF";
            }
          }

          // Extract the two teams
          const team0 = teams["0"]?.team;
          const team1 = teams["1"]?.team;
          if (!team0 || !team1) continue;

          const extractManagerId = (teamArr: any[]): string => {
            let rawSlot = "";
            for (const item of teamArr[0] ?? []) {
              if (Array.isArray(item)) {
                for (const sub of item) {
                  if (sub?.managers) {
                    rawSlot = String(sub.managers[0]?.manager?.manager_id ?? "");
                    break;
                  }
                }
                if (rawSlot) break;
              } else if (typeof item === "object" && item?.managers) {
                rawSlot = String(item.managers[0]?.manager?.manager_id ?? "");
                break;
              }
            }
            // Fallback to team_key
            if (!rawSlot) {
              for (const item of teamArr[0] ?? []) {
                if (typeof item === "object" && item?.team_key) {
                  rawSlot = item.team_key;
                  break;
                }
              }
            }
            // Resolve through slotToIdentity map
            return rawSlot ? resolveSlotToIdentity(rawSlot, slotToIdentity) : "";
          };

          const extractScore = (teamArr: any[]): number | null => {
            const points = teamArr[1]?.team_points;
            if (points?.total) return parseFloat(points.total);
            return null;
          };

          const homeManagerId = extractManagerId(team0);
          const awayManagerId = extractManagerId(team1);

          if (homeManagerId && awayManagerId) {
            matchups.push({
              week,
              matchupType,
              homeManagerId,
              awayManagerId,
              homeScore: extractScore(team0),
              awayScore: extractScore(team1),
            });
          }
        }
      } catch {
        // If a week fails (e.g., hasn't happened yet), skip it
        continue;
      }
    }

    // ── Parse draft picks ──
    const draftPicks: ProviderDraftPick[] = [];
    try {
      if (draftData) {
        const league = draftData.fantasy_content.league;
        const draftsWrapper = league[1]?.draft_results;
        if (draftsWrapper) {
          const pickCount =
            typeof draftsWrapper.count === "number" ? draftsWrapper.count : 0;
          for (let i = 0; i < pickCount; i++) {
            const pickEntry = draftsWrapper[String(i)];
            if (!pickEntry?.draft_result) continue;
            const pick = pickEntry.draft_result;

            const pickSlot = String(pick.manager_id ?? "");
            draftPicks.push({
              round: parseInt(pick.round ?? "0", 10),
              pickNumber: parseInt(pick.pick ?? "0", 10),
              managerProviderManagerId: resolveSlotToIdentity(pickSlot, slotToIdentity),
              playerName: pick.player_name
                ? `${pick.player_name}`
                : `Player (key: ${pick.player_key ?? "unknown"})`,
              position: pick.position ?? null,
            });
          }
        }
      }
    } catch {
      // Draft data parsing failed — continue without it
    }

    // ── Parse transactions ──
    const transactions: ProviderTransaction[] = [];
    try {
      if (transactionsData) {
        const league = transactionsData.fantasy_content.league;
        const txnsWrapper = league[1]?.transactions;
        if (txnsWrapper) {
          const txnCount =
            typeof txnsWrapper.count === "number" ? txnsWrapper.count : 0;
          for (let i = 0; i < txnCount; i++) {
            const txnEntry = txnsWrapper[String(i)];
            if (!txnEntry?.transaction) continue;

            const txnMeta = txnEntry.transaction[0];
            const txnPlayers = txnEntry.transaction[1]?.players;

            // Map Yahoo transaction type to our type
            let txnType: ProviderTransaction["type"];
            const yahooType = txnMeta.type;
            switch (yahooType) {
              case "add":
                txnType = "ADD";
                break;
              case "drop":
                txnType = "DROP";
                break;
              case "trade":
                txnType = "TRADE";
                break;
              case "add/drop":
                // add/drop is a waiver claim — treat as WAIVER
                txnType = "WAIVER";
                break;
              default:
                txnType = "ADD";
            }

            const txnDate = txnMeta.timestamp
              ? new Date(parseInt(txnMeta.timestamp, 10) * 1000)
              : null;

            // Extract players involved in the transaction
            if (txnPlayers) {
              const playerCount =
                typeof txnPlayers.count === "number" ? txnPlayers.count : 0;
              for (let p = 0; p < playerCount; p++) {
                const playerEntry = txnPlayers[String(p)];
                if (!playerEntry?.player) continue;

                const playerInfo = playerEntry.player[0];
                const txnData = playerEntry.player[1]?.transaction_data;

                // Extract player name from the nested info array
                let playerName = "Unknown Player";
                for (const item of playerInfo ?? []) {
                  if (typeof item === "object" && item?.name) {
                    playerName = item.name.full ?? item.name.first ?? playerName;
                    break;
                  }
                }

                // The manager who performed the action
                const sourceManagerId =
                  txnData?.source_team_key ??
                  txnData?.destination_team_key ??
                  txnMeta.trader_team_key ??
                  "";

                // Resolve through slotToIdentity map
                const managerId =
                  sourceManagerId
                    ? resolveSlotToIdentity(sourceManagerId, slotToIdentity)
                    : "";

                transactions.push({
                  type:
                    txnData?.type === "drop"
                      ? "DROP"
                      : txnData?.type === "add"
                        ? txnType === "WAIVER"
                          ? "WAIVER"
                          : "ADD"
                        : txnType,
                  managerProviderManagerId: managerId,
                  playerName,
                  week: txnMeta.week ? parseInt(txnMeta.week, 10) : null,
                  transactionDate: txnDate,
                });
              }
            }
          }
        }
      }
    } catch {
      // Transaction parsing failed — continue without it
    }

    // Determine champion — rank 1 in standings (already using identity keys)
    const championManagerId =
      standings[0]?.managerProviderManagerId ?? null;

    return {
      year,
      managers,
      matchups,
      draftPicks,
      transactions,
      standings,
      championManagerId,
    };
  },
};
