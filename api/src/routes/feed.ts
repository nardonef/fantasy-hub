import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireLeagueMember } from "../middleware/auth";
import { getRosterPlayerIds } from "../lib/roster";
import type { SignalSource, SignalType } from "../generated/prisma/client";

const router = Router();

const SIGNAL_SOURCES = new Set(["REDDIT", "BLUESKY", "SPORTSDATA", "FANTASYPROS", "TWITTER"]);
const SIGNAL_TYPES = new Set(["RANKING_CHANGE", "SOCIAL_MENTION", "STATS_UPDATE", "RECOMMENDATION"]);
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * GET /api/leagues/:leagueId/feed
 *
 * Paginated signal feed for a league. Cursor-based pagination on fetchedAt.
 *
 * Query params:
 *   source      – filter by SignalSource (REDDIT | BLUESKY | SPORTSDATA | FANTASYPROS)
 *   type        – filter by SignalType  (RANKING_CHANGE | SOCIAL_MENTION | STATS_UPDATE | RECOMMENDATION)
 *   playerId    – filter to a single player
 *   limit       – number of results (default 20, max 100)
 *   cursor      – ISO fetchedAt of the last item from the previous page
 */
router.get("/:leagueId/feed", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const {
      source,
      type,
      playerId,
      position,
      myRosterOnly,
      limit: rawLimit,
      cursor,
    } = req.query as Record<string, string | undefined>;

    if (source && !SIGNAL_SOURCES.has(source)) {
      res.status(400).json({ error: `Invalid source. Must be one of: ${[...SIGNAL_SOURCES].join(", ")}` });
      return;
    }
    if (type && !SIGNAL_TYPES.has(type)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${[...SIGNAL_TYPES].join(", ")}` });
      return;
    }
    if (position && !POSITIONS.has(position.toUpperCase())) {
      res.status(400).json({ error: `Invalid position. Must be one of: ${[...POSITIONS].join(", ")}` });
      return;
    }

    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);

    // Roster filter: if myRosterOnly=true, resolve the user's current roster
    let rosterPlayerIds: Set<string> | null = null;
    const dbUser = (req as any).dbUser as { id: string } | undefined;
    if (myRosterOnly === "true" && dbUser) {
      rosterPlayerIds = await getRosterPlayerIds(req.params.leagueId as string, dbUser.id);
    }

    const where: Record<string, unknown> = {};
    if (source) where.source = source as SignalSource;
    if (type) where.signalType = type as SignalType;
    if (playerId) where.playerId = playerId;
    if (cursor) where.fetchedAt = { lt: new Date(cursor) };

    // Player-level filters: roster and/or position
    const playerWhere: Record<string, unknown> = {};
    if (rosterPlayerIds !== null) {
      // Empty set = user has no players on roster — return nothing
      playerWhere.id = { in: [...rosterPlayerIds] };
    }
    if (position) {
      playerWhere.position = position.toUpperCase();
    }
    if (Object.keys(playerWhere).length > 0) {
      where.player = playerWhere;
    }

    const signals = await prisma.signal.findMany({
      where,
      include: {
        player: { select: { id: true, fullName: true, position: true, nflTeam: true } },
      },
      orderBy: { fetchedAt: "desc" },
      take: limit + 1, // fetch one extra to determine if there's a next page
    });

    const hasMore = signals.length > limit;
    const page = hasMore ? signals.slice(0, limit) : signals;
    const nextCursor = hasMore ? page[page.length - 1]?.fetchedAt.toISOString() ?? null : null;

    res.json({ signals: page, nextCursor });
  } catch (err) {
    console.error("feed error:", err);
    res.status(500).json({ error: "Failed to load feed" });
  }
});

/**
 * GET /api/leagues/:leagueId/recommendations
 *
 * Returns top players by signal activity in the last 7 days, scored by
 * number of distinct sources (confidence proxy). Useful for waiver/start-sit decisions.
 *
 * Query params:
 *   limit – number of player cards to return (default 20, max 50)
 */
router.get("/:leagueId/recommendations", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { limit: rawLimit } = req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(rawLimit ?? "20", 10) || 20, 50);

    const since = new Date();
    since.setDate(since.getDate() - 7);

    // Aggregate signals per player over the last 7 days
    const recentSignals = await prisma.signal.findMany({
      where: { fetchedAt: { gte: since } },
      include: {
        player: { select: { id: true, fullName: true, position: true, nflTeam: true } },
      },
      orderBy: { fetchedAt: "desc" },
    });

    // Group by player: count signals, collect distinct sources, keep latest signal
    const byPlayer = new Map<string, {
      player: { id: string; fullName: string; position: string | null; nflTeam: string | null };
      signalCount: number;
      sources: Set<string>;
      latestSignal: typeof recentSignals[number];
    }>();

    for (const signal of recentSignals) {
      const existing = byPlayer.get(signal.playerId);
      if (existing) {
        existing.signalCount++;
        existing.sources.add(signal.source);
      } else {
        byPlayer.set(signal.playerId, {
          player: signal.player,
          signalCount: 1,
          sources: new Set([signal.source]),
          latestSignal: signal,
        });
      }
    }

    // Sort by confidence (distinct source count desc, then signal count desc), cap at limit
    const ranked = [...byPlayer.values()]
      .sort((a, b) => {
        const sourcesDiff = b.sources.size - a.sources.size;
        return sourcesDiff !== 0 ? sourcesDiff : b.signalCount - a.signalCount;
      })
      .slice(0, limit)
      .map(({ player, signalCount, sources, latestSignal }) => ({
        player,
        signalCount,
        confidence: sources.size, // 1–4: number of distinct sources
        sources: [...sources],
        latestSignal: {
          id: latestSignal.id,
          signalType: latestSignal.signalType,
          content: latestSignal.content,
          publishedAt: latestSignal.publishedAt,
          fetchedAt: latestSignal.fetchedAt,
        },
      }));

    res.json({ recommendations: ranked, since: since.toISOString() });
  } catch (err) {
    console.error("recommendations error:", err);
    res.status(500).json({ error: "Failed to load recommendations" });
  }
});

export default router;
