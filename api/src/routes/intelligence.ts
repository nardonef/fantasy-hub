import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireLeagueMember } from "../middleware/auth";
import { generateCards, buildRosterNews } from "../intelligence/card-generator";
import { getRosterPlayerIds } from "../lib/roster";

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/leagues/:leagueId/intelligence
 *
 * Returns personalized intelligence for the authenticated user:
 *   actionItems   – typed IntelligenceCards (start/sit, waivers, injuries, etc.)
 *   rosterNews    – recent signals for the user's rostered players
 *   leagueSignals – general signal feed (paginated)
 *
 * Query params:
 *   weekOpponent=true  – include opponent's roster in rosterNews
 *   limit              – number of leagueSignals to return (default 20, max 50)
 *   cursor             – ISO fetchedAt for paginating leagueSignals
 */
router.get("/:leagueId/intelligence", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const leagueId = req.params.leagueId as string;
    const dbUser = (req as any).dbUser as { id: string };
    const { weekOpponent, myRosterOnly, limit: rawLimit, cursor } = req.query as Record<string, string | undefined>;

    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const includeOpponent = weekOpponent === "true";
    const rosterOnly = myRosterOnly === "true";

    // Run action card generation and roster news in parallel.
    // Roster news is scoped to the user's own roster only — no opponent.
    const [actionItems, rosterNews] = await Promise.all([
      generateCards(leagueId, dbUser.id, prisma, { weekOpponent: includeOpponent }),
      buildRosterNews(leagueId, dbUser.id, prisma, {}),
    ]);

    // General signal feed (paginated), optionally scoped to user's roster.
    // If the roster lookup fails (manager not linked), myRosterOnly falls back
    // to an empty result rather than silently returning everything.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where: Record<string, unknown> = { fetchedAt: { gte: sevenDaysAgo } };
    if (cursor) where.fetchedAt = { gte: sevenDaysAgo, lt: new Date(cursor) };
    if (rosterOnly) {
      const rosterIds = await getRosterPlayerIds(leagueId, dbUser.id);
      where.playerId = { in: rosterIds && rosterIds.size > 0 ? [...rosterIds] : [] };
    }

    const rawSignals = await prisma.signal.findMany({
      where,
      include: {
        player: { select: { id: true, fullName: true, position: true, nflTeam: true } },
      },
      orderBy: { fetchedAt: "desc" },
      take: limit + 1,
    });

    const hasMore = rawSignals.length > limit;
    const page = hasMore ? rawSignals.slice(0, limit) : rawSignals;
    const nextCursor = hasMore ? (page[page.length - 1]?.fetchedAt.toISOString() ?? null) : null;

    const leagueSignals = page.map((s) => ({
      id: s.id,
      playerId: s.playerId,
      source: s.source,
      signalType: s.signalType,
      content: s.content,
      publishedAt: s.publishedAt,
      fetchedAt: s.fetchedAt,
      player: s.player,
    }));

    res.json({
      actionItems,
      rosterNews,
      leagueSignals,
      nextCursor,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("intelligence error:", err);
    res.status(500).json({ error: "Failed to generate intelligence" });
  }
});

/**
 * GET /api/leagues/:leagueId/briefing
 *
 * Stub: returns the top-3 players by signal count as briefing takeaways.
 * The real implementation will use the V2 LLM synthesis pipeline.
 */
router.get("/:leagueId/briefing", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const leagueId = req.params.leagueId as string;
    const dbUser = (req as any).dbUser as { id: string };

    res.set("Cache-Control", "public, max-age=300");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all recent signals grouped by player
    const signals = await prisma.signal.findMany({
      where: { fetchedAt: { gte: sevenDaysAgo } },
      include: { player: { select: { id: true, fullName: true, position: true, nflTeam: true } } },
      orderBy: { fetchedAt: "desc" },
    });

    // Group by player, pick top 3 by signal count
    const byPlayer = new Map<string, { player: typeof signals[0]["player"]; signals: typeof signals }>();
    for (const s of signals) {
      const existing = byPlayer.get(s.playerId);
      if (existing) {
        existing.signals.push(s);
      } else {
        byPlayer.set(s.playerId, { player: s.player, signals: [s] });
      }
    }

    const top3 = Array.from(byPlayer.values())
      .sort((a, b) => b.signals.length - a.signals.length)
      .slice(0, 3);

    const tagForSignalType = (type: string): string => {
      if (type === "RANKING_CHANGE") return "WATCH";
      if (type === "STATS_UPDATE") return "START";
      return "WATCH";
    };

    const takeaways = top3.map((entry, i) => ({
      id: `briefing-${entry.player.id}-${i}`,
      tag: tagForSignalType(entry.signals[0]?.signalType ?? ""),
      player: entry.player,
      headline: `Monitor ${entry.player.fullName} — ${entry.signals.length} signal${entry.signals.length === 1 ? "" : "s"} this week`,
      rationale: entry.signals[0]?.content?.slice(0, 140) ?? "Multiple signals indicate attention needed.",
      projectedDelta: null,
      confidence: Math.min(entry.signals.length, 4),
      sources: entry.signals.slice(0, 2).map((s) => ({
        kind: s.source,
        label: s.source.charAt(0).toUpperCase() + s.source.slice(1).toLowerCase(),
      })),
      rank7d: [],
    }));

    res.json({
      synthesizedAt: new Date().toISOString(),
      signalCount: signals.length,
      sourceCount: new Set(signals.map((s) => s.source)).size,
      takeaways,
    });
  } catch (err) {
    console.error("briefing error:", err);
    res.status(500).json({ error: "Failed to generate briefing" });
  }
});

/**
 * GET /api/players/:playerId/ai-summary
 *
 * Stub: returns a placeholder AI summary until V2 LLM pipeline is ready.
 */
router.get("/:leagueId/players/:playerId/ai-summary", requireAuth, requireLeagueMember, async (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({ verdict: "watch", body: "No AI summary available yet — check back after the V2 intelligence pipeline launches.", confidence: 1, signalCount: 0 });
});

export default router;
