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
