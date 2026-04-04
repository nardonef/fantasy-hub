import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireLeagueMember } from "../middleware/auth";

const router = Router();

/** GET /api/leagues/:leagueId/analytics/standings
 *  Season standings with optional year filter */
router.get("/:leagueId/analytics/standings", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    const where: any = { season: { leagueId } };
    if (year) where.season.year = year;

    const standings = await prisma.seasonManager.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true, avatarUrl: true } },
        season: { select: { year: true } },
      },
      orderBy: [{ season: { year: "desc" } }, { finalRank: "asc" }],
    });

    res.json(standings);
  } catch (err) {
    console.error("standings error:", err);
    res.status(500).json({ error: "Failed to load standings" });
  }
});

/** GET /api/leagues/:leagueId/analytics/h2h
 *  Head-to-head records between all managers */
router.get("/:leagueId/analytics/h2h", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    const matchupWhere: any = { season: { leagueId } };
    if (year) matchupWhere.season.year = year;

    const matchups = await prisma.matchup.findMany({
      where: matchupWhere,
      include: {
        homeManager: { select: { id: true, name: true } },
        awayManager: { select: { id: true, name: true } },
      },
    });

    // Build H2H matrix
    const h2h = new Map<string, { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number }>();

    for (const m of matchups) {
      if (m.homeScore === null || m.awayScore === null) continue;

      const key = `${m.homeManagerId}:${m.awayManagerId}`;
      const reverseKey = `${m.awayManagerId}:${m.homeManagerId}`;

      const homeRecord = h2h.get(key) ?? { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
      const awayRecord = h2h.get(reverseKey) ?? { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };

      if (m.homeScore > m.awayScore) {
        homeRecord.wins++;
        awayRecord.losses++;
      } else if (m.awayScore > m.homeScore) {
        awayRecord.wins++;
        homeRecord.losses++;
      } else {
        homeRecord.ties++;
        awayRecord.ties++;
      }

      homeRecord.pointsFor += m.homeScore;
      homeRecord.pointsAgainst += m.awayScore;
      awayRecord.pointsFor += m.awayScore;
      awayRecord.pointsAgainst += m.homeScore;

      h2h.set(key, homeRecord);
      h2h.set(reverseKey, awayRecord);
    }

    // Convert to response format
    const records: Array<{
      managerId: string;
      opponentId: string;
      wins: number;
      losses: number;
      ties: number;
      pointsFor: number;
      pointsAgainst: number;
    }> = [];

    for (const [key, record] of h2h) {
      const [managerId, opponentId] = key.split(":");
      records.push({ managerId, opponentId, ...record });
    }

    // Get manager names
    const managers = await prisma.manager.findMany({
      where: { leagueId },
      select: { id: true, name: true, avatarUrl: true },
    });

    res.json({ managers, records });
  } catch (err) {
    console.error("h2h error:", err);
    res.status(500).json({ error: "Failed to load head-to-head data" });
  }
});

/** GET /api/leagues/:leagueId/analytics/scoring
 *  Scoring trends over time */
router.get("/:leagueId/analytics/scoring", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const includeWeekly = req.query.includeWeekly === "true";

    const matchupWhere: any = { season: { leagueId } };
    if (year) matchupWhere.season.year = year;

    const matchups = await prisma.matchup.findMany({
      where: matchupWhere,
      include: {
        season: { select: { year: true } },
        homeManager: { select: { id: true, name: true } },
        awayManager: { select: { id: true, name: true } },
      },
      orderBy: [{ season: { year: "asc" } }, { week: "asc" }],
    });

    // Build per-manager weekly scoring
    const managerScores = new Map<string, Array<{ year: number; week: number; score: number }>>();

    for (const m of matchups) {
      if (m.homeScore === null || m.awayScore === null) continue;

      const homeScores = managerScores.get(m.homeManagerId) ?? [];
      homeScores.push({ year: m.season.year, week: m.week, score: m.homeScore });
      managerScores.set(m.homeManagerId, homeScores);

      const awayScores = managerScores.get(m.awayManagerId) ?? [];
      awayScores.push({ year: m.season.year, week: m.week, score: m.awayScore });
      managerScores.set(m.awayManagerId, awayScores);
    }

    // Calculate stats per manager
    const managers = await prisma.manager.findMany({
      where: { leagueId },
      select: { id: true, name: true },
    });

    const scoringData = managers.map((manager) => {
      const scores = managerScores.get(manager.id) ?? [];
      const total = scores.reduce((sum, s) => sum + s.score, 0);
      const avg = scores.length > 0 ? total / scores.length : 0;
      const max = scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0;
      const min = scores.length > 0 ? Math.min(...scores.map((s) => s.score)) : 0;
      const stdDev =
        scores.length > 1
          ? Math.sqrt(
              scores.reduce((sum, s) => sum + Math.pow(s.score - avg, 2), 0) /
                (scores.length - 1)
            )
          : 0;

      const entry: any = {
        managerId: manager.id,
        managerName: manager.name,
        gamesPlayed: scores.length,
        totalPoints: Math.round(total * 100) / 100,
        avgPoints: Math.round(avg * 100) / 100,
        maxPoints: max,
        minPoints: min,
        consistency: Math.round(stdDev * 100) / 100, // lower = more consistent
      };

      // Only include weeklyScores when explicitly requested to reduce payload size
      if (includeWeekly) {
        entry.weeklyScores = scores;
      }

      return entry;
    });

    res.json(scoringData);
  } catch (err) {
    console.error("scoring error:", err);
    res.status(500).json({ error: "Failed to load scoring data" });
  }
});

/** GET /api/leagues/:leagueId/analytics/draft
 *  Draft analysis across seasons */
router.get("/:leagueId/analytics/draft", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    const where: any = { season: { leagueId } };
    if (year) where.season.year = year;

    const picks = await prisma.draftPick.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true } },
        season: { select: { year: true } },
      },
      orderBy: [{ season: { year: "desc" } }, { pickNumber: "asc" }],
    });

    res.json(picks);
  } catch (err) {
    console.error("draft error:", err);
    res.status(500).json({ error: "Failed to load draft data" });
  }
});

/** GET /api/leagues/:leagueId/analytics/records
 *  League records and milestones */
router.get("/:leagueId/analytics/records", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;

    // Fetch all matchups with scores to find highest individual performances
    const allMatchups = await prisma.matchup.findMany({
      where: { season: { leagueId }, homeScore: { not: null }, awayScore: { not: null } },
      include: {
        homeManager: { select: { id: true, name: true } },
        awayManager: { select: { id: true, name: true } },
        season: { select: { year: true } },
      },
    });

    // Build team name lookup from SeasonManager
    const seasonManagers = await prisma.seasonManager.findMany({
      where: { season: { leagueId } },
      select: { seasonId: true, managerId: true, teamName: true },
    });
    const teamNameMap = new Map<string, string>();
    for (const sm of seasonManagers) {
      teamNameMap.set(`${sm.seasonId}:${sm.managerId}`, sm.teamName);
    }

    // Build all individual scores from both home and away sides
    const allScores: Array<{
      score: number;
      managerId: string;
      managerName: string;
      opponentName: string;
      opponentScore: number;
      week: number;
      year: number;
      seasonId: string;
    }> = [];

    for (const m of allMatchups) {
      if (m.homeScore === null || m.awayScore === null) continue;
      const homeName = teamNameMap.get(`${m.seasonId}:${m.homeManagerId}`) ?? m.homeManager.name;
      const awayName = teamNameMap.get(`${m.seasonId}:${m.awayManagerId}`) ?? m.awayManager.name;

      allScores.push({
        score: m.homeScore, managerId: m.homeManagerId,
        managerName: homeName, opponentName: awayName,
        opponentScore: m.awayScore, week: m.week, year: m.season.year, seasonId: m.seasonId,
      });
      allScores.push({
        score: m.awayScore, managerId: m.awayManagerId,
        managerName: awayName, opponentName: homeName,
        opponentScore: m.homeScore, week: m.week, year: m.season.year, seasonId: m.seasonId,
      });
    }

    // Top 10 highest individual scores
    allScores.sort((a, b) => b.score - a.score);
    const highestScores = allScores.slice(0, 10).map((s) => ({
      score: s.score,
      manager: s.managerName,
      opponent: s.opponentName,
      opponentScore: s.opponentScore,
      week: s.week,
      year: s.year,
    }));

    // Champion history
    const champions = await prisma.season.findMany({
      where: { leagueId, championManagerId: { not: null } },
      orderBy: { year: "desc" },
      select: { year: true, championManagerId: true },
    });

    // All-time win leaders
    const allTimeRecords = await prisma.seasonManager.groupBy({
      by: ["managerId"],
      where: { season: { leagueId } },
      _sum: { wins: true, losses: true, ties: true, pointsFor: true, pointsAgainst: true },
      orderBy: { _sum: { wins: "desc" } },
    });

    const managers = await prisma.manager.findMany({
      where: { leagueId },
      select: { id: true, name: true, avatarUrl: true },
    });
    const managerMap = new Map(managers.map((m) => [m.id, m]));

    res.json({
      highestScores,
      champions: champions.map((c) => ({
        year: c.year,
        manager: (managerMap.get(c.championManagerId!) as any)?.name ?? "Unknown",
      })),
      allTimeRecords: allTimeRecords.map((r) => ({
        manager: managerMap.get(r.managerId),
        wins: r._sum.wins ?? 0,
        losses: r._sum.losses ?? 0,
        ties: r._sum.ties ?? 0,
        pointsFor: Math.round((r._sum.pointsFor ?? 0) * 100) / 100,
        pointsAgainst: Math.round((r._sum.pointsAgainst ?? 0) * 100) / 100,
      })),
    });
  } catch (err) {
    console.error("records error:", err);
    res.status(500).json({ error: "Failed to load records" });
  }
});

/** GET /api/leagues/:leagueId/analytics/extremes
 *  Top/bottom performances, closest games, biggest blowouts */
router.get("/:leagueId/analytics/extremes", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

  const matchups = await prisma.matchup.findMany({
    where: { season: { leagueId }, homeScore: { not: null }, awayScore: { not: null } },
    include: {
      homeManager: { select: { id: true, name: true } },
      awayManager: { select: { id: true, name: true } },
      season: { select: { year: true } },
    },
  });

  // Build team name lookup from SeasonManager
  const seasonManagers = await prisma.seasonManager.findMany({
    where: { season: { leagueId } },
    select: { seasonId: true, managerId: true, teamName: true },
  });
  const teamNameMap = new Map<string, string>();
  for (const sm of seasonManagers) {
    teamNameMap.set(`${sm.seasonId}:${sm.managerId}`, sm.teamName);
  }

  // Build all individual game scores
  const gameScores: Array<{
    score: number;
    manager: string;
    opponent: string;
    opponentScore: number;
    week: number;
    year: number;
    matchupType: string;
  }> = [];

  const gameResults: Array<{
    margin: number;
    winnerScore: number;
    loserScore: number;
    winner: string;
    loser: string;
    week: number;
    year: number;
    matchupType: string;
  }> = [];

  for (const m of matchups) {
    if (m.homeScore === null || m.awayScore === null) continue;

    const homeName = teamNameMap.get(`${m.seasonId}:${m.homeManagerId}`) ?? m.homeManager.name;
    const awayName = teamNameMap.get(`${m.seasonId}:${m.awayManagerId}`) ?? m.awayManager.name;

    gameScores.push({
      score: m.homeScore,
      manager: homeName,
      opponent: awayName,
      opponentScore: m.awayScore,
      week: m.week,
      year: m.season.year,
      matchupType: m.matchupType,
    });
    gameScores.push({
      score: m.awayScore,
      manager: awayName,
      opponent: homeName,
      opponentScore: m.homeScore,
      week: m.week,
      year: m.season.year,
      matchupType: m.matchupType,
    });

    const margin = Math.abs(m.homeScore - m.awayScore);
    const homeWon = m.homeScore > m.awayScore;
    gameResults.push({
      margin: Math.round(margin * 100) / 100,
      winnerScore: homeWon ? m.homeScore : m.awayScore,
      loserScore: homeWon ? m.awayScore : m.homeScore,
      winner: homeWon ? homeName : awayName,
      loser: homeWon ? awayName : homeName,
      week: m.week,
      year: m.season.year,
      matchupType: m.matchupType,
    });
  }

  // Top performances (default 10, max 50)
  const topPerformances = [...gameScores].sort((a, b) => b.score - a.score).slice(0, limit);

  // Bottom performances
  const bottomPerformances = [...gameScores].sort((a, b) => a.score - b.score).slice(0, limit);

  // Closest games (non-tie)
  const closestGames = [...gameResults].filter((g) => g.margin > 0).sort((a, b) => a.margin - b.margin).slice(0, limit);

  // Biggest blowouts
  const biggestBlowouts = [...gameResults].sort((a, b) => b.margin - a.margin).slice(0, limit);

    res.json({ topPerformances, bottomPerformances, closestGames, biggestBlowouts });
  } catch (err) {
    console.error("extremes error:", err);
    res.status(500).json({ error: "Failed to load extremes data" });
  }
});

/** GET /api/leagues/:leagueId/analytics/playoffs
 *  Playoff vs regular season performance, clutch ratings */
router.get("/:leagueId/analytics/playoffs", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;

    const matchups = await prisma.matchup.findMany({
    where: { season: { leagueId }, homeScore: { not: null }, awayScore: { not: null } },
    include: {
      homeManager: { select: { id: true, name: true } },
      awayManager: { select: { id: true, name: true } },
    },
  });

  // Per-manager: regular season PPG vs playoff PPG
  const managerStats = new Map<string, { name: string; regScores: number[]; playoffScores: number[] }>();

  for (const m of matchups) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const isPlayoff = m.matchupType === "PLAYOFF" || m.matchupType === "CHAMPIONSHIP";

    for (const [managerId, managerName, score] of [
      [m.homeManagerId, m.homeManager.name, m.homeScore],
      [m.awayManagerId, m.awayManager.name, m.awayScore],
    ] as [string, string, number][]) {
      const stats = managerStats.get(managerId) ?? { name: managerName, regScores: [], playoffScores: [] };
      if (isPlayoff) {
        stats.playoffScores.push(score);
      } else {
        stats.regScores.push(score);
      }
      managerStats.set(managerId, stats);
    }
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const playoffData = Array.from(managerStats.entries()).map(([managerId, stats]) => {
    const regPPG = avg(stats.regScores);
    const playoffPPG = avg(stats.playoffScores);
    return {
      managerId,
      managerName: stats.name,
      regularSeasonPPG: Math.round(regPPG * 100) / 100,
      playoffPPG: Math.round(playoffPPG * 100) / 100,
      playoffGames: stats.playoffScores.length,
      clutchRating: Math.round((playoffPPG - regPPG) * 100) / 100,
    };
  }).filter((d) => d.playoffGames > 0)
    .sort((a, b) => b.clutchRating - a.clutchRating);

    res.json(playoffData);
  } catch (err) {
    console.error("playoffs error:", err);
    res.status(500).json({ error: "Failed to load playoff data" });
  }
});

/** GET /api/leagues/:leagueId/analytics/distribution
 *  Score distribution histogram data */
router.get("/:leagueId/analytics/distribution", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

  const matchupWhere: any = { season: { leagueId }, homeScore: { not: null } };
  if (year) matchupWhere.season = { ...matchupWhere.season, year };

  const matchups = await prisma.matchup.findMany({
    where: matchupWhere,
    select: { homeScore: true, awayScore: true },
  });

  // Collect all individual scores
  const allScores: number[] = [];
  for (const m of matchups) {
    if (m.homeScore !== null) allScores.push(m.homeScore);
    if (m.awayScore !== null) allScores.push(m.awayScore);
  }

  // Build histogram with 10-point buckets
  const buckets = [
    { label: "0-70", min: 0, max: 70, count: 0 },
    { label: "70-80", min: 70, max: 80, count: 0 },
    { label: "80-90", min: 80, max: 90, count: 0 },
    { label: "90-100", min: 90, max: 100, count: 0 },
    { label: "100-110", min: 100, max: 110, count: 0 },
    { label: "110-120", min: 110, max: 120, count: 0 },
    { label: "120-130", min: 120, max: 130, count: 0 },
    { label: "130-140", min: 130, max: 140, count: 0 },
    { label: "140-150", min: 140, max: 150, count: 0 },
    { label: "150+", min: 150, max: Infinity, count: 0 },
  ];

  for (const score of allScores) {
    const bucket = buckets.find((b) => score >= b.min && score < b.max);
    if (bucket) bucket.count++;
  }

    res.json({
      totalScores: allScores.length,
      mean: allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100 : 0,
      median: allScores.length > 0 ? allScores.sort((a, b) => a - b)[Math.floor(allScores.length / 2)] : 0,
      buckets: buckets.map((b) => ({ label: b.label, count: b.count })),
    });
  } catch (err) {
    console.error("distribution error:", err);
    res.status(500).json({ error: "Failed to load distribution data" });
  }
});

/** GET /api/leagues/:leagueId/analytics/dashboard
 *  Personal dashboard stats for the authenticated user's claimed manager */
router.get("/:leagueId/analytics/dashboard", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const user = (req as any).dbUser;

    // Find user's claimed manager
    const manager = await prisma.manager.findFirst({
      where: { leagueId, userId: user.id },
      select: { id: true, name: true },
    });

    if (!manager) {
      res.json(null);
      return;
    }

    // Get all season records for this manager
    const seasonManagers = await prisma.seasonManager.findMany({
      where: { managerId: manager.id },
      include: { season: { select: { year: true, championManagerId: true } } },
      orderBy: { season: { year: "asc" } },
    });

    // All-time record
    const allTimeRecord = {
      wins: seasonManagers.reduce((s, sm) => s + sm.wins, 0),
      losses: seasonManagers.reduce((s, sm) => s + sm.losses, 0),
      ties: seasonManagers.reduce((s, sm) => s + sm.ties, 0),
    };

    // Championships and playoff appearances
    const championships = seasonManagers.filter(
      (sm) => sm.season.championManagerId === manager.id
    ).length;
    const playoffAppearances = seasonManagers.filter((sm) => sm.madePlayoffs).length;

    // Rank history
    const rankHistory = seasonManagers
      .filter((sm) => sm.finalRank !== null)
      .map((sm) => ({ year: sm.season.year, rank: sm.finalRank! }));

    // Scoring averages
    const totalPF = seasonManagers.reduce((s, sm) => s + sm.pointsFor, 0);
    const totalGames = allTimeRecord.wins + allTimeRecord.losses + allTimeRecord.ties;
    const myAvgPPG = totalGames > 0 ? Math.round((totalPF / totalGames) * 100) / 100 : 0;

    // League average PPG
    const allSeasonManagers = await prisma.seasonManager.findMany({
      where: { season: { leagueId } },
      select: { pointsFor: true, wins: true, losses: true, ties: true },
    });
    const leagueTotalPF = allSeasonManagers.reduce((s, sm) => s + sm.pointsFor, 0);
    const leagueTotalGames = allSeasonManagers.reduce(
      (s, sm) => s + sm.wins + sm.losses + sm.ties,
      0
    );
    const leagueAvgPPG =
      leagueTotalGames > 0 ? Math.round((leagueTotalPF / leagueTotalGames) * 100) / 100 : 0;

    // H2H rivals — find best and worst matchups
    const matchups = await prisma.matchup.findMany({
      where: {
        season: { leagueId },
        homeScore: { not: null },
        awayScore: { not: null },
        OR: [{ homeManagerId: manager.id }, { awayManagerId: manager.id }],
      },
      include: {
        homeManager: { select: { id: true, name: true } },
        awayManager: { select: { id: true, name: true } },
      },
    });

    const rivalMap = new Map<string, { name: string; wins: number; losses: number }>();

    for (const m of matchups) {
      if (m.homeScore === null || m.awayScore === null) continue;

      const isHome = m.homeManagerId === manager.id;
      const opponentId = isHome ? m.awayManagerId : m.homeManagerId;
      const opponentName = isHome ? m.awayManager.name : m.homeManager.name;
      const myScore = isHome ? m.homeScore : m.awayScore;
      const theirScore = isHome ? m.awayScore : m.homeScore;

      const rival = rivalMap.get(opponentId) ?? { name: opponentName, wins: 0, losses: 0 };
      if (myScore > theirScore) rival.wins++;
      else if (theirScore > myScore) rival.losses++;
      rivalMap.set(opponentId, rival);
    }

    // Require a meaningful sample size — at least 6 games to qualify as a rival
    const rivals = Array.from(rivalMap.values()).filter((r) => r.wins + r.losses >= 6);
    // Score rivals by win rate weighted by volume: winPct * log2(totalGames)
    // This surfaces long-term rivals over 2-game flukes
    const rivalScore = (r: { wins: number; losses: number }, favorable: boolean) => {
      const total = r.wins + r.losses;
      const winPct = r.wins / total;
      const pct = favorable ? winPct : 1 - winPct;
      return pct * Math.log2(total);
    };
    const bestRival = [...rivals].sort((a, b) => rivalScore(b, true) - rivalScore(a, true))[0] ?? null;
    const worstRival = [...rivals].sort((a, b) => rivalScore(b, false) - rivalScore(a, false))[0] ?? null;

    res.json({
      myManagerId: manager.id,
      allTimeRecord,
      championships,
      playoffAppearances,
      rankHistory,
      bestRival: bestRival ? { name: bestRival.name, wins: bestRival.wins, losses: bestRival.losses } : null,
      worstRival: worstRival ? { name: worstRival.name, wins: worstRival.wins, losses: worstRival.losses } : null,
      leagueAvgPpg: leagueAvgPPG,
      myAvgPpg: myAvgPPG,
    });
  } catch (err) {
    console.error("dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

export default router;
