import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireLeagueMember } from "../middleware/auth";

const router = Router();

/** GET /api/leagues/:leagueId/managers/:managerId/profile
 *  Manager career stats and season-by-season results */
router.get("/:leagueId/managers/:managerId/profile", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId, managerId } = req.params as Record<string, string>;

    // Fetch manager
    const manager = await prisma.manager.findFirst({
    where: { id: managerId, leagueId },
    select: { id: true, name: true, avatarUrl: true },
  });

  if (!manager) {
    res.status(404).json({ error: "Manager not found" });
    return;
  }

  // Fetch season entries for this manager
  const seasonEntries = await prisma.seasonManager.findMany({
    where: { managerId, season: { leagueId } },
    include: {
      season: { select: { year: true, championManagerId: true } },
    },
    orderBy: { season: { year: "desc" } },
  });

  // Career record totals
  const totalWins = seasonEntries.reduce((sum, e) => sum + e.wins, 0);
  const totalLosses = seasonEntries.reduce((sum, e) => sum + e.losses, 0);
  const totalTies = seasonEntries.reduce((sum, e) => sum + e.ties, 0);
  const careerPointsFor = Math.round(seasonEntries.reduce((sum, e) => sum + e.pointsFor, 0) * 100) / 100;
  const careerPointsAgainst = Math.round(seasonEntries.reduce((sum, e) => sum + e.pointsAgainst, 0) * 100) / 100;

  // Championships and playoff appearances
  const championships = seasonEntries.filter((e) => e.season.championManagerId === managerId).length;
  const playoffAppearances = seasonEntries.filter((e) => e.madePlayoffs).length;

  // Best/worst finish
  const finishes = seasonEntries.map((e) => e.finalRank).filter((r): r is number => r !== null);
  const bestFinish = finishes.length > 0 ? Math.min(...finishes) : null;
  const worstFinish = finishes.length > 0 ? Math.max(...finishes) : null;

  // Fetch all matchups for this manager to find high/low scoring weeks
  const matchups = await prisma.matchup.findMany({
    where: {
      season: { leagueId },
      OR: [{ homeManagerId: managerId }, { awayManagerId: managerId }],
      homeScore: { not: null },
      awayScore: { not: null },
    },
    include: {
      season: { select: { year: true } },
    },
  });

  // Extract this manager's scores from each matchup
  const weeklyScores: Array<{ year: number; week: number; score: number }> = [];
  for (const m of matchups) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const score = m.homeManagerId === managerId ? m.homeScore : m.awayScore;
    weeklyScores.push({ year: m.season.year, week: m.week, score });
  }

  // Sort to find highest and lowest
  const sortedScores = [...weeklyScores].sort((a, b) => b.score - a.score);
  const highestScoringWeek = sortedScores.length > 0 ? sortedScores[0] : null;
  const lowestScoringWeek = sortedScores.length > 0 ? sortedScores[sortedScores.length - 1] : null;

  // Average PPG
  const totalGames = weeklyScores.length;
  const totalPoints = weeklyScores.reduce((sum, s) => sum + s.score, 0);
  const avgPointsPerGame = totalGames > 0 ? Math.round((totalPoints / totalGames) * 100) / 100 : 0;

  // Build season results
  const seasonResults = seasonEntries.map((e) => ({
    year: e.season.year,
    teamName: e.teamName,
    finalRank: e.finalRank,
    wins: e.wins,
    losses: e.losses,
    ties: e.ties,
    pointsFor: Math.round(e.pointsFor * 100) / 100,
    madePlayoffs: e.madePlayoffs,
    isChampion: e.season.championManagerId === managerId,
  }));

    res.json({
      manager,
      seasonsPlayed: seasonEntries.length,
      careerRecord: { wins: totalWins, losses: totalLosses, ties: totalTies },
      championships,
      playoffAppearances,
      careerPointsFor,
      careerPointsAgainst,
      bestFinish,
      worstFinish,
      highestScoringWeek,
      lowestScoringWeek,
      avgPointsPerGame,
      seasonResults,
    });
  } catch (err) {
    console.error("manager profile error:", err);
    res.status(500).json({ error: "Failed to load manager profile" });
  }
});

export default router;
