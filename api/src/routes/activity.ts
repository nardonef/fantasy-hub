import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireLeagueMember } from "../middleware/auth";

const router = Router();

/** GET /api/leagues/:leagueId/activity
 *  Recent activity feed generated from league data */
router.get("/:leagueId/activity", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

  const activities: Array<{
    id: string;
    type: string;
    title: string;
    detail: string | null;
    timestamp: string;
    managerName: string | null;
    iconName: string | null;
  }> = [];

  // 1. League connection (use league createdAt)
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true, createdAt: true },
  });

  if (league) {
    activities.push({
      id: `league-connected-${leagueId}`,
      type: "LEAGUE_CONNECTED",
      title: "League Connected",
      detail: `${league.name} was connected to Fantasy Hub.`,
      timestamp: league.createdAt.toISOString(),
      managerName: null,
      iconName: "link.circle.fill",
    });
  }

  // 2. Season imports (one activity per imported season)
  const seasons = await prisma.season.findMany({
    where: { leagueId, status: "IMPORTED" },
    orderBy: { year: "desc" },
    select: { id: true, year: true, createdAt: true, championManagerId: true },
  });

  for (const season of seasons) {
    activities.push({
      id: `season-imported-${season.id}`,
      type: "SEASON_IMPORTED",
      title: "Season Imported",
      detail: `${season.year} season data has been imported.`,
      timestamp: season.createdAt.toISOString(),
      managerName: null,
      iconName: "arrow.down.circle.fill",
    });
  }

  // 3. Champions crowned
  const championSeasons = await prisma.season.findMany({
    where: { leagueId, championManagerId: { not: null } },
    orderBy: { year: "desc" },
    select: { id: true, year: true, championManagerId: true, createdAt: true },
  });

  // Get champion manager names
  const championManagerIds = championSeasons
    .map((s) => s.championManagerId)
    .filter((id): id is string => id !== null);

  const championManagers = await prisma.manager.findMany({
    where: { id: { in: championManagerIds } },
    select: { id: true, name: true },
  });
  const championMap = new Map<string, string>(championManagers.map((m) => [m.id, m.name]));

  for (const season of championSeasons) {
    const championId = season.championManagerId as string | null;
    if (!championId) continue;
    const managerName = championMap.get(championId) ?? "Unknown";
    activities.push({
      id: `champion-${season.id}`,
      type: "CHAMPION_CROWNED",
      title: `${season.year} Champion`,
      detail: `${managerName} won the ${season.year} championship!`,
      timestamp: season.createdAt.toISOString(),
      managerName,
      iconName: "trophy.fill",
    });
  }

  // 4. Import complete (most recent completed sync job)
  const completedSync = await prisma.syncJob.findFirst({
    where: { leagueId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true, completedAt: true },
  });

  if (completedSync && completedSync.completedAt) {
    activities.push({
      id: `import-complete-${completedSync.id}`,
      type: "IMPORT_COMPLETE",
      title: "Import Complete",
      detail: "All league data has been imported successfully.",
      timestamp: completedSync.completedAt.toISOString(),
      managerName: null,
      iconName: "checkmark.circle.fill",
    });
  }

  // 5. Record broken: find the all-time high scorer and create a record activity
  const highestScoreMatchup = await prisma.matchup.findFirst({
    where: { season: { leagueId }, homeScore: { not: null } },
    orderBy: { homeScore: "desc" },
    include: {
      homeManager: { select: { name: true } },
      season: { select: { year: true, createdAt: true } },
    },
  });

  // Also check away scores
  const highestAwayMatchup = await prisma.matchup.findFirst({
    where: { season: { leagueId }, awayScore: { not: null } },
    orderBy: { awayScore: "desc" },
    include: {
      awayManager: { select: { name: true } },
      season: { select: { year: true, createdAt: true } },
    },
  });

  if (highestScoreMatchup || highestAwayMatchup) {
    const homeHigh = highestScoreMatchup?.homeScore ?? 0;
    const awayHigh = highestAwayMatchup?.awayScore ?? 0;

    if (homeHigh >= awayHigh && highestScoreMatchup) {
      activities.push({
        id: `record-high-score`,
        type: "RECORD_BROKEN",
        title: "All-Time High Score",
        detail: `${highestScoreMatchup.homeManager.name} scored ${highestScoreMatchup.homeScore} points in Week ${highestScoreMatchup.week}, ${highestScoreMatchup.season.year}.`,
        timestamp: highestScoreMatchup.season.createdAt.toISOString(),
        managerName: highestScoreMatchup.homeManager.name,
        iconName: "flame.fill",
      });
    } else if (highestAwayMatchup) {
      activities.push({
        id: `record-high-score`,
        type: "RECORD_BROKEN",
        title: "All-Time High Score",
        detail: `${highestAwayMatchup.awayManager.name} scored ${highestAwayMatchup.awayScore} points in Week ${highestAwayMatchup.week}, ${highestAwayMatchup.season.year}.`,
        timestamp: highestAwayMatchup.season.createdAt.toISOString(),
        managerName: highestAwayMatchup.awayManager.name,
        iconName: "flame.fill",
      });
    }
  }

  // Sort by timestamp descending (most recent first)
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Support pagination via ?page=&limit= query params
  if (req.query.page || req.query.limit) {
    const total = activities.length;
    const start = (page - 1) * limit;
    const items = activities.slice(start, start + limit);
    res.json({ items, total, page, hasMore: start + limit < total });
  } else {
    // Backwards compatible: return flat array when no pagination params
    res.json(activities);
  }
  } catch (err) {
    console.error("activity error:", err);
    res.status(500).json({ error: "Failed to load activity feed" });
  }
});

export default router;
