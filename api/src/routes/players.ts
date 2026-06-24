import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * GET /api/players/search?q=<name>
 *
 * Searches players by name prefix (case-insensitive). Returns up to 10 matches.
 * Minimum query length: 2 characters.
 */
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? "";
    if (q.length < 2) {
      res.status(400).json({ error: "Query must be at least 2 characters" });
      return;
    }

    const players = await prisma.player.findMany({
      where: {
        fullName: { contains: q, mode: "insensitive" },
      },
      select: { id: true, fullName: true, position: true, nflTeam: true, status: true },
      orderBy: { fullName: "asc" },
      take: 10,
    });

    res.json({ players });
  } catch (err) {
    console.error("player search error:", err);
    res.status(500).json({ error: "Failed to search players" });
  }
});

/**
 * GET /api/players/:playerId/ranking-history
 *
 * Returns a player's ECR ranking history across all ranking sources, ordered
 * chronologically. Each data point includes the date, overall rank, position
 * rank, rank delta, and source (e.g. FANTASYPROS). Designed to support
 * multiple ranking sources in the future — callers should group by source
 * to render separate lines per provider.
 */
router.get("/:playerId/ranking-history", requireAuth, async (req, res) => {
  try {
    const { playerId } = req.params as Record<string, string>;

    const snapshots = await prisma.playerRankingSnapshot.findMany({
      where: { playerId },
      select: { id: true, source: true, date: true, rankEcr: true, posRank: true, rankDelta: true },
      orderBy: { date: "asc" },
    });

    const points = snapshots.map((s) => ({
      id: s.id,
      date: new Date(s.date),
      overallRank: s.rankEcr,
      positionRank: s.posRank,
      rankDelta: s.rankDelta,
      source: s.source,
    }));

    res.json({ points });
  } catch (err) {
    console.error("ranking-history error:", err);
    res.status(500).json({ error: "Failed to load ranking history" });
  }
});

/**
 * GET /api/players/:playerId
 *
 * Returns a player's profile with their 50 most recent signals.
 */
router.get("/:playerId", requireAuth, async (req, res) => {
  try {
    const { playerId } = req.params as Record<string, string>;

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        signals: {
          orderBy: { publishedAt: "desc" },
          take: 50,
          select: {
            id: true,
            source: true,
            signalType: true,
            content: true,
            metadata: true,
            publishedAt: true,
            fetchedAt: true,
          },
        },
      },
    });

    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    res.json({ player });
  } catch (err) {
    console.error("player detail error:", err);
    res.status(500).json({ error: "Failed to load player" });
  }
});

export default router;
