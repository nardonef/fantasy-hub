/**
 * tools.ts — OpenAI tool definitions and server-side executors.
 *
 * Each tool is a thin wrapper over the same Prisma queries that power the
 * V1 analytics routes. Tools query the DB directly — no HTTP calls.
 *
 * The tool names here use underscores (OpenAI function-call convention).
 * The spec §6 table uses camelCase names; we align with the OpenAI convention
 * since the function name is what the model sees and must match exactly.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { PrismaClient } from "../../generated/prisma/client";

// ─── Tool Definitions (OpenAI schema) ───────────────────────────────────────

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_standings",
      description:
        "Returns season standings for the league. Includes each manager's win/loss/tie record, points for, points against, final rank, and whether they made the playoffs. Optionally filtered to a specific season year.",
      parameters: {
        type: "object",
        properties: {
          season: {
            type: "number",
            description: "The season year to filter by (e.g. 2023). Omit for all seasons.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_manager_stats",
      description:
        "Returns career or single-season scoring stats for a specific manager: games played, total points, average PPG, max/min scores, and consistency (score std dev). Optionally filtered to a specific season year.",
      parameters: {
        type: "object",
        properties: {
          managerId: {
            type: "string",
            description: "The manager's internal ID.",
          },
          season: {
            type: "number",
            description: "The season year to filter by (e.g. 2023). Omit for all-time stats.",
          },
        },
        required: ["managerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_matchup_history",
      description:
        "Returns the head-to-head record between two specific managers across all seasons: wins, losses, ties, and points for/against.",
      parameters: {
        type: "object",
        properties: {
          managerIdA: {
            type: "string",
            description: "The first manager's internal ID.",
          },
          managerIdB: {
            type: "string",
            description: "The second manager's internal ID.",
          },
        },
        required: ["managerIdA", "managerIdB"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_draft_results",
      description:
        "Returns all draft picks for a specific season, ordered by pick number. Includes round, pick number, player name, position, and which manager drafted them.",
      parameters: {
        type: "object",
        properties: {
          season: {
            type: "number",
            description: "The season year (e.g. 2023). Required.",
          },
        },
        required: ["season"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_scores",
      description:
        "Returns matchup scores for a given season. Optionally filtered to a specific week. Returns each matchup with both managers' scores, week number, and matchup type (regular, playoff, championship).",
      parameters: {
        type: "object",
        properties: {
          season: {
            type: "number",
            description: "The season year (e.g. 2023). Required.",
          },
          week: {
            type: "number",
            description: "A specific week number to filter by. Omit for the full season.",
          },
        },
        required: ["season"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_league_records",
      description:
        "Returns all-time league records: the top 10 highest individual scores ever posted, champion history by year, and all-time win leaders with career points totals.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_playoff_results",
      description:
        "Returns playoff performance data for all managers: regular season PPG vs playoff PPG, number of playoff games played, and clutch rating (playoff PPG minus regular season PPG). Optionally filtered to a specific season.",
      parameters: {
        type: "object",
        properties: {
          season: {
            type: "number",
            description: "The season year to filter by (e.g. 2023). Omit for all-time data.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transaction_history",
      description:
        "Returns transaction history for the league: adds, drops, trades, and waiver claims. Optionally filtered by season year or transaction type.",
      parameters: {
        type: "object",
        properties: {
          season: {
            type: "number",
            description: "The season year to filter by (e.g. 2023). Omit for all seasons.",
          },
          type: {
            type: "string",
            enum: ["ADD", "DROP", "TRADE", "WAIVER"],
            description: "Filter by transaction type. Omit for all types.",
          },
        },
        required: [],
      },
    },
  },
];

// ─── Tool Executors ──────────────────────────────────────────────────────────

async function getStandings(
  args: { season?: number },
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const where: any = { season: { leagueId } };
  if (args.season) where.season = { ...where.season, year: args.season };

  const standings = await prisma.seasonManager.findMany({
    where,
    include: {
      manager: { select: { id: true, name: true } },
      season: { select: { year: true } },
    },
    orderBy: [{ season: { year: "desc" } }, { finalRank: "asc" }],
  });

  return standings.map((s) => ({
    season: s.season.year,
    managerId: s.managerId,
    managerName: s.manager.name,
    teamName: s.teamName,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    finalRank: s.finalRank,
    madePlayoffs: s.madePlayoffs,
  }));
}

async function getManagerStats(
  args: { managerId: string; season?: number },
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const matchupWhere: any = {
    season: { leagueId },
    homeScore: { not: null },
    awayScore: { not: null },
    OR: [{ homeManagerId: args.managerId }, { awayManagerId: args.managerId }],
  };
  if (args.season) matchupWhere.season = { ...matchupWhere.season, year: args.season };

  const matchups = await prisma.matchup.findMany({
    where: matchupWhere,
    include: { season: { select: { year: true } } },
  });

  const scores: number[] = [];
  for (const m of matchups) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const score = m.homeManagerId === args.managerId ? m.homeScore : m.awayScore;
    scores.push(score);
  }

  const manager = await prisma.manager.findUnique({
    where: { id: args.managerId },
    select: { id: true, name: true },
  });

  if (scores.length === 0) {
    return { managerId: args.managerId, managerName: manager?.name ?? "Unknown", gamesPlayed: 0 };
  }

  const total = scores.reduce((a, b) => a + b, 0);
  const avg = total / scores.length;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const stdDev =
    scores.length > 1
      ? Math.sqrt(scores.reduce((s, sc) => s + Math.pow(sc - avg, 2), 0) / (scores.length - 1))
      : 0;

  // Also include season-level W/L from SeasonManager
  const smWhere: any = { managerId: args.managerId, season: { leagueId } };
  if (args.season) smWhere.season = { ...smWhere.season, year: args.season };
  const seasonManagers = await prisma.seasonManager.findMany({
    where: smWhere,
    select: { wins: true, losses: true, ties: true, season: { select: { year: true } } },
  });
  const totalWins = seasonManagers.reduce((s, sm) => s + sm.wins, 0);
  const totalLosses = seasonManagers.reduce((s, sm) => s + sm.losses, 0);
  const totalTies = seasonManagers.reduce((s, sm) => s + sm.ties, 0);

  return {
    managerId: args.managerId,
    managerName: manager?.name ?? "Unknown",
    gamesPlayed: scores.length,
    wins: totalWins,
    losses: totalLosses,
    ties: totalTies,
    totalPoints: Math.round(total * 100) / 100,
    avgPPG: Math.round(avg * 100) / 100,
    maxScore: max,
    minScore: min,
    consistency: Math.round(stdDev * 100) / 100,
  };
}

async function getMatchupHistory(
  args: { managerIdA: string; managerIdB: string },
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const matchups = await prisma.matchup.findMany({
    where: {
      season: { leagueId },
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [
        { homeManagerId: args.managerIdA, awayManagerId: args.managerIdB },
        { homeManagerId: args.managerIdB, awayManagerId: args.managerIdA },
      ],
    },
    include: {
      season: { select: { year: true } },
      homeManager: { select: { id: true, name: true } },
      awayManager: { select: { id: true, name: true } },
    },
    orderBy: [{ season: { year: "asc" } }, { week: "asc" }],
  });

  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let pointsForA = 0;
  let pointsForB = 0;

  const games: Array<{
    year: number;
    week: number;
    scoreA: number;
    scoreB: number;
    winner: string | null;
  }> = [];

  for (const m of matchups) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const aIsHome = m.homeManagerId === args.managerIdA;
    const scoreA = aIsHome ? m.homeScore : m.awayScore;
    const scoreB = aIsHome ? m.awayScore : m.homeScore;

    pointsForA += scoreA;
    pointsForB += scoreB;

    let winner: string | null = null;
    if (scoreA > scoreB) {
      winsA++;
      winner = args.managerIdA;
    } else if (scoreB > scoreA) {
      winsB++;
      winner = args.managerIdB;
    } else {
      ties++;
    }

    games.push({ year: m.season.year, week: m.week, scoreA, scoreB, winner });
  }

  const managerA = await prisma.manager.findUnique({
    where: { id: args.managerIdA },
    select: { name: true },
  });
  const managerB = await prisma.manager.findUnique({
    where: { id: args.managerIdB },
    select: { name: true },
  });

  return {
    managerA: { id: args.managerIdA, name: managerA?.name ?? "Unknown" },
    managerB: { id: args.managerIdB, name: managerB?.name ?? "Unknown" },
    winsA,
    winsB,
    ties,
    pointsForA: Math.round(pointsForA * 100) / 100,
    pointsForB: Math.round(pointsForB * 100) / 100,
    totalGames: winsA + winsB + ties,
    games,
  };
}

async function getDraftResults(
  args: { season: number },
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const picks = await prisma.draftPick.findMany({
    where: { season: { leagueId, year: args.season } },
    include: {
      manager: { select: { id: true, name: true } },
    },
    orderBy: [{ round: "asc" }, { pickNumber: "asc" }],
  });

  return {
    season: args.season,
    totalPicks: picks.length,
    picks: picks.map((p) => ({
      round: p.round,
      pickNumber: p.pickNumber,
      managerId: p.managerId,
      managerName: p.manager.name,
      playerName: p.playerName,
      position: p.position,
    })),
  };
}

async function getWeeklyScores(
  args: { season: number; week?: number },
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const where: any = {
    season: { leagueId, year: args.season },
    homeScore: { not: null },
    awayScore: { not: null },
  };
  if (args.week !== undefined) where.week = args.week;

  const matchups = await prisma.matchup.findMany({
    where,
    include: {
      homeManager: { select: { id: true, name: true } },
      awayManager: { select: { id: true, name: true } },
    },
    orderBy: [{ week: "asc" }],
  });

  return {
    season: args.season,
    week: args.week ?? null,
    matchups: matchups.map((m) => ({
      week: m.week,
      matchupType: m.matchupType,
      homeManager: { id: m.homeManagerId, name: m.homeManager.name },
      awayManager: { id: m.awayManagerId, name: m.awayManager.name },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winner:
        m.homeScore !== null && m.awayScore !== null
          ? m.homeScore > m.awayScore
            ? m.homeManagerId
            : m.awayScore > m.homeScore
            ? m.awayManagerId
            : null
          : null,
    })),
  };
}

async function getLeagueRecords(
  _args: Record<string, never>,
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const allMatchups = await prisma.matchup.findMany({
    where: { season: { leagueId }, homeScore: { not: null }, awayScore: { not: null } },
    include: {
      homeManager: { select: { id: true, name: true } },
      awayManager: { select: { id: true, name: true } },
      season: { select: { year: true } },
    },
  });

  const allScores: Array<{
    score: number;
    managerName: string;
    opponentName: string;
    opponentScore: number;
    week: number;
    year: number;
  }> = [];

  for (const m of allMatchups) {
    if (m.homeScore === null || m.awayScore === null) continue;
    allScores.push({
      score: m.homeScore,
      managerName: m.homeManager.name,
      opponentName: m.awayManager.name,
      opponentScore: m.awayScore,
      week: m.week,
      year: m.season.year,
    });
    allScores.push({
      score: m.awayScore,
      managerName: m.awayManager.name,
      opponentName: m.homeManager.name,
      opponentScore: m.homeScore,
      week: m.week,
      year: m.season.year,
    });
  }

  allScores.sort((a, b) => b.score - a.score);
  const highestScores = allScores.slice(0, 10);

  const champions = await prisma.season.findMany({
    where: { leagueId, championManagerId: { not: null } },
    orderBy: { year: "desc" },
    select: { year: true, championManagerId: true },
  });

  const allTimeRecords = await prisma.seasonManager.groupBy({
    by: ["managerId"],
    where: { season: { leagueId } },
    _sum: { wins: true, losses: true, ties: true, pointsFor: true },
    orderBy: { _sum: { wins: "desc" } },
  });

  const managers = await prisma.manager.findMany({
    where: { leagueId },
    select: { id: true, name: true },
  });
  const managerMap = new Map(managers.map((m) => [m.id, m.name]));

  return {
    highestScores: highestScores.map((s) => ({
      score: s.score,
      manager: s.managerName,
      opponent: s.opponentName,
      opponentScore: s.opponentScore,
      week: s.week,
      year: s.year,
    })),
    champions: champions.map((c) => ({
      year: c.year,
      manager: managerMap.get(c.championManagerId!) ?? "Unknown",
    })),
    allTimeWinLeaders: allTimeRecords.map((r) => ({
      manager: managerMap.get(r.managerId) ?? "Unknown",
      wins: r._sum.wins ?? 0,
      losses: r._sum.losses ?? 0,
      ties: r._sum.ties ?? 0,
      totalPointsFor: Math.round((r._sum.pointsFor ?? 0) * 100) / 100,
    })),
  };
}

async function getPlayoffResults(
  args: { season?: number },
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const where: any = {
    season: { leagueId },
    homeScore: { not: null },
    awayScore: { not: null },
  };
  if (args.season) where.season = { ...where.season, year: args.season };

  const matchups = await prisma.matchup.findMany({
    where,
    include: {
      homeManager: { select: { id: true, name: true } },
      awayManager: { select: { id: true, name: true } },
      season: { select: { year: true } },
    },
  });

  const managerStats = new Map<
    string,
    { name: string; regScores: number[]; playoffScores: number[]; seasons: Set<number> }
  >();

  for (const m of matchups) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const isPlayoff = m.matchupType === "PLAYOFF" || m.matchupType === "CHAMPIONSHIP";

    for (const [managerId, managerName, score] of [
      [m.homeManagerId, m.homeManager.name, m.homeScore],
      [m.awayManagerId, m.awayManager.name, m.awayScore],
    ] as [string, string, number][]) {
      const stats = managerStats.get(managerId) ?? {
        name: managerName,
        regScores: [],
        playoffScores: [],
        seasons: new Set<number>(),
      };
      if (isPlayoff) {
        stats.playoffScores.push(score);
        stats.seasons.add(m.season.year);
      } else {
        stats.regScores.push(score);
      }
      managerStats.set(managerId, stats);
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const results = Array.from(managerStats.entries())
    .map(([managerId, stats]) => {
      const regPPG = avg(stats.regScores);
      const playoffPPG = avg(stats.playoffScores);
      return {
        managerId,
        managerName: stats.name,
        regularSeasonPPG: Math.round(regPPG * 100) / 100,
        playoffPPG: Math.round(playoffPPG * 100) / 100,
        playoffGames: stats.playoffScores.length,
        playoffSeasons: stats.seasons.size,
        clutchRating: Math.round((playoffPPG - regPPG) * 100) / 100,
      };
    })
    .filter((d) => d.playoffGames > 0)
    .sort((a, b) => b.clutchRating - a.clutchRating);

  return {
    season: args.season ?? "all-time",
    managers: results,
  };
}

async function getTransactionHistory(
  args: { season?: number; type?: string },
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  const where: any = { season: { leagueId } };
  if (args.season) where.season = { ...where.season, year: args.season };
  if (args.type) where.type = args.type;

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      manager: { select: { id: true, name: true } },
      season: { select: { year: true } },
    },
    orderBy: [{ season: { year: "desc" } }, { week: "desc" }],
    // Cap at 200 rows to keep tool responses manageable
    take: 200,
  });

  return {
    totalReturned: transactions.length,
    filters: { season: args.season ?? null, type: args.type ?? null },
    transactions: transactions.map((t) => ({
      id: t.id,
      season: t.season.year,
      week: t.week,
      type: t.type,
      managerId: t.managerId,
      managerName: t.manager.name,
      playerName: t.playerName,
      date: t.transactionDate,
    })),
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/**
 * Execute a tool by name. Returns a JSON-serializable result.
 * Throws if the tool name is unknown.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  leagueId: string,
  prisma: PrismaClient
): Promise<unknown> {
  switch (toolName) {
    case "get_standings":
      return getStandings(args as { season?: number }, leagueId, prisma);
    case "get_manager_stats":
      return getManagerStats(args as { managerId: string; season?: number }, leagueId, prisma);
    case "get_matchup_history":
      return getMatchupHistory(
        args as { managerIdA: string; managerIdB: string },
        leagueId,
        prisma
      );
    case "get_draft_results":
      return getDraftResults(args as { season: number }, leagueId, prisma);
    case "get_weekly_scores":
      return getWeeklyScores(args as { season: number; week?: number }, leagueId, prisma);
    case "get_league_records":
      return getLeagueRecords({} as Record<string, never>, leagueId, prisma);
    case "get_playoff_results":
      return getPlayoffResults(args as { season?: number }, leagueId, prisma);
    case "get_transaction_history":
      return getTransactionHistory(
        args as { season?: number; type?: string },
        leagueId,
        prisma
      );
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
