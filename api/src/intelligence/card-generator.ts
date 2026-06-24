import type { PrismaClient, Signal } from "../generated/prisma/client";
import { getRosterPlayerIds } from "../lib/roster";
import type { Sentiment } from "./signal-scorer";
import {
  scorePlayer,
  recentInjurySignals,
  hotRedditSignals,
  rankingShiftSignals,
} from "./signal-scorer";

// Re-export Sentiment so callers don't need to import from both modules
export type { Sentiment };

export type IntelligenceCardType =
  | "START_SIT"
  | "WAIVER_ALERT"
  | "INJURY_NEWS"
  | "RANKING_SHIFT"
  | "HOT_TAKE";

export interface FeedPlayer {
  id: string;
  fullName: string;
  position: string | null;
  nflTeam: string | null;
}

export interface IntelligenceCard {
  type: IntelligenceCardType;
  headline: string;
  body: string;
  confidence: 1 | 2 | 3 | 4;
  players: FeedPlayer[];
  sources: string[];
  signalIds: string[];
  generatedAt: string;
}

export interface IntelligenceResponse {
  actionItems: IntelligenceCard[];
  rosterNews: ReturnType<typeof formatSignal>[];
  leagueSignals: ReturnType<typeof formatSignal>[];
  nextCursor: string | null;
  generatedAt: string;
}

function formatSignal(signal: Signal & { player: FeedPlayer }) {
  return {
    id: signal.id,
    playerId: signal.playerId,
    source: signal.source,
    signalType: signal.signalType,
    content: signal.content,
    publishedAt: signal.publishedAt,
    fetchedAt: signal.fetchedAt,
    player: signal.player,
  };
}

const URGENCY_ORDER: Record<IntelligenceCardType, number> = {
  INJURY_NEWS: 0,
  START_SIT: 1,
  WAIVER_ALERT: 2,
  RANKING_SHIFT: 3,
  HOT_TAKE: 4,
};

/**
 * Core intelligence engine. Generates typed action cards from signals +
 * roster context. Designed as a standalone function (not Express-bound) so
 * it can be wrapped as an AI tool in V3.
 */
export async function generateCards(
  leagueId: string,
  dbUserId: string,
  prisma: PrismaClient,
  opts: { weekOpponent?: boolean } = {}
): Promise<IntelligenceCard[]> {
  const rosterIds = await getRosterPlayerIds(leagueId, dbUserId);
  if (!rosterIds || rosterIds.size === 0) return [];

  const rosterIdArray = [...rosterIds];

  // Optionally extend rosterNews to include current-week opponent
  let opponentIds: Set<string> = new Set();
  if (opts.weekOpponent) {
    opponentIds = await getOpponentRosterIds(leagueId, dbUserId, prisma);
  }

  // Fetch last 7 days of signals for all players (for scoring)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const allSignals = await prisma.signal.findMany({
    where: { fetchedAt: { gte: sevenDaysAgo } },
    include: {
      player: { select: { id: true, fullName: true, position: true, nflTeam: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  // Group signals by playerId
  const signalsByPlayer = new Map<string, (Signal & { player: FeedPlayer })[]>();
  for (const signal of allSignals) {
    const list = signalsByPlayer.get(signal.playerId) ?? [];
    list.push(signal);
    signalsByPlayer.set(signal.playerId, list);
  }

  const cards: IntelligenceCard[] = [];
  const now = new Date().toISOString();

  // ── INJURY_NEWS ──────────────────────────────────────────────────────────
  for (const playerId of rosterIdArray) {
    const signals = signalsByPlayer.get(playerId) ?? [];
    const injurySignals = recentInjurySignals(signals);
    if (injurySignals.length === 0) continue;

    const player = injurySignals[0].player;
    const sources = [...new Set(injurySignals.map((s) => s.source))];
    const headline = `Injury alert: ${player.fullName}`;
    const body = injurySignals[0].content;

    cards.push({
      type: "INJURY_NEWS",
      headline,
      body,
      confidence: Math.min(4, Math.max(1, sources.length)) as 1 | 2 | 3 | 4,
      players: [player],
      sources,
      signalIds: injurySignals.map((s) => s.id),
      generatedAt: now,
    });
  }

  // ── RANKING_SHIFT ────────────────────────────────────────────────────────
  for (const playerId of rosterIdArray) {
    const signals = signalsByPlayer.get(playerId) ?? [];
    const shifts = rankingShiftSignals(signals);
    if (shifts.length === 0) continue;

    const player = shifts[0].player;
    const meta = shifts[0].metadata as Record<string, unknown> | null;
    const delta = typeof meta?.rankDelta === "number" ? meta.rankDelta : 0;
    const direction = delta > 0 ? "up" : "down";
    const headline = `${player.fullName} ranked ${direction} ${Math.abs(delta)} spots`;
    const body = shifts[0].content;

    cards.push({
      type: "RANKING_SHIFT",
      headline,
      body,
      confidence: 2,
      players: [player],
      sources: ["FANTASYPROS"],
      signalIds: shifts.map((s) => s.id),
      generatedAt: now,
    });
  }

  // ── HOT_TAKE ─────────────────────────────────────────────────────────────
  for (const playerId of rosterIdArray) {
    const signals = signalsByPlayer.get(playerId) ?? [];
    const hotSignals = hotRedditSignals(signals);
    if (hotSignals.length === 0) continue;

    const player = hotSignals[0].player;
    const meta = hotSignals[0].metadata as Record<string, unknown> | null;
    const upvotes = typeof meta?.score === "number" ? meta.score : 0;
    const headline = `Reddit buzz: ${player.fullName} (${upvotes.toLocaleString()} upvotes)`;
    const body = hotSignals[0].content;

    cards.push({
      type: "HOT_TAKE",
      headline,
      body,
      confidence: 2,
      players: [player],
      sources: ["REDDIT"],
      signalIds: hotSignals.map((s) => s.id),
      generatedAt: now,
    });
  }

  // ── WAIVER_ALERT ─────────────────────────────────────────────────────────
  // Players NOT on user's roster with high recent signal velocity
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const waiverCandidates: Array<{
    player: FeedPlayer;
    signalCount: number;
    sources: string[];
    signals: Signal[];
  }> = [];

  for (const [playerId, signals] of signalsByPlayer) {
    if (rosterIds.has(playerId)) continue;

    const recent = signals.filter((s) => s.publishedAt >= fortyEightHoursAgo);
    if (recent.length < 3) continue;

    const sources = [...new Set(recent.map((s) => s.source))];
    waiverCandidates.push({
      player: signals[0].player,
      signalCount: recent.length,
      sources,
      signals: recent,
    });
  }

  // Sort by signal velocity (most recent signals first, then count)
  waiverCandidates.sort((a, b) => b.signalCount - a.signalCount);

  for (const candidate of waiverCandidates.slice(0, 3)) {
    const headline = `Pick up ${candidate.player.fullName} — trending on waivers`;
    const body = `${candidate.signalCount} signals in the last 48 hours across ${candidate.sources.join(", ")}`;

    cards.push({
      type: "WAIVER_ALERT",
      headline,
      body,
      confidence: Math.min(4, Math.max(1, candidate.sources.length)) as 1 | 2 | 3 | 4,
      players: [candidate.player],
      sources: candidate.sources,
      signalIds: candidate.signals.map((s) => s.id),
      generatedAt: now,
    });
  }

  // ── START_SIT ────────────────────────────────────────────────────────────
  // Score rostered players by position; pair those with diverging confidence
  const rosterByPosition = new Map<string, Array<{
    player: FeedPlayer;
    score: ReturnType<typeof scorePlayer>;
    signals: (Signal & { player: FeedPlayer })[];
  }>>();

  for (const playerId of rosterIdArray) {
    const signals = signalsByPlayer.get(playerId) ?? [];
    if (signals.length === 0) continue;

    const player = signals[0].player;
    if (!player.position) continue;

    const score = scorePlayer(signals);
    const list = rosterByPosition.get(player.position) ?? [];
    list.push({ player, score, signals });
    rosterByPosition.set(player.position, list);
  }

  for (const [, players] of rosterByPosition) {
    if (players.length < 2) continue;

    // Sort descending by confidence, then score
    players.sort((a, b) =>
      b.score.confidence !== a.score.confidence
        ? b.score.confidence - a.score.confidence
        : b.score.score - a.score.score
    );

    const top = players[0];
    const bottom = players[players.length - 1];
    if (top.score.confidence - bottom.score.confidence < 2) continue;

    // Don't recommend starting a player with negative sentiment
    if (top.score.sentiment === "negative") continue;

    const allSources = [...new Set([
      ...top.signals.map((s) => s.source),
      ...bottom.signals.map((s) => s.source),
    ])];
    const allSignalIds = [
      ...top.signals.map((s) => s.id),
      ...bottom.signals.map((s) => s.id),
    ];
    const headline = `Start ${top.player.fullName} over ${bottom.player.fullName}`;
    const topSentiment = top.score.sentiment === "positive" ? " (trending up)" : "";
    const bottomSentiment = bottom.score.sentiment === "negative" ? " (injury concern)" : "";
    const body = `${top.player.fullName}${topSentiment} has stronger signal support; ${bottom.player.fullName}${bottomSentiment} has less momentum this week`;

    cards.push({
      type: "START_SIT",
      headline,
      body,
      confidence: top.score.confidence,
      players: [top.player, bottom.player],
      sources: allSources,
      signalIds: allSignalIds,
      generatedAt: now,
    });
  }

  // Sort by urgency, cap at 5 action items
  return cards
    .sort((a, b) => URGENCY_ORDER[a.type] - URGENCY_ORDER[b.type])
    .slice(0, 5);
}

/**
 * Builds the roster news feed: signals for the user's players +
 * optionally their current-week opponent's players.
 */
export async function buildRosterNews(
  leagueId: string,
  dbUserId: string,
  prisma: PrismaClient,
  opts: { weekOpponent?: boolean; limit?: number } = {}
): Promise<ReturnType<typeof formatSignal>[]> {
  const rosterIds = await getRosterPlayerIds(leagueId, dbUserId);
  if (!rosterIds || rosterIds.size === 0) return [];

  const playerIds = [...rosterIds];

  if (opts.weekOpponent) {
    const opponentIds = await getOpponentRosterIds(leagueId, dbUserId, prisma);
    for (const id of opponentIds) playerIds.push(id);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const signals = await prisma.signal.findMany({
    where: {
      playerId: { in: playerIds },
      fetchedAt: { gte: sevenDaysAgo },
    },
    include: {
      player: { select: { id: true, fullName: true, position: true, nflTeam: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: opts.limit ?? 50,
  });

  return signals.map(formatSignal);
}

/**
 * Attempt to find the current week opponent's roster.
 * Best-effort: looks for the most recent matchup involving the user's manager
 * in the current season. Returns an empty set if not found.
 */
async function getOpponentRosterIds(
  leagueId: string,
  dbUserId: string,
  prisma: PrismaClient
): Promise<Set<string>> {
  const manager = await prisma.manager.findFirst({
    where: { leagueId, userId: dbUserId },
    select: { id: true },
  });
  if (!manager) return new Set();

  // Find the most recent season for this league
  const latestSeason = await prisma.season.findFirst({
    where: { leagueId },
    orderBy: { year: "desc" },
    select: { id: true },
  });
  if (!latestSeason) return new Set();

  // Find the highest-week matchup involving this manager
  const matchup = await prisma.matchup.findFirst({
    where: {
      seasonId: latestSeason.id,
      OR: [
        { homeManagerId: manager.id },
        { awayManagerId: manager.id },
      ],
    },
    orderBy: { week: "desc" },
    select: { homeManagerId: true, awayManagerId: true },
  });
  if (!matchup) return new Set();

  const opponentManagerId =
    matchup.homeManagerId === manager.id
      ? matchup.awayManagerId
      : matchup.homeManagerId;

  const opponentRosterRows = await prisma.rosterPlayer.findMany({
    where: { leagueId, managerId: opponentManagerId },
    select: { playerId: true },
  });

  return new Set(
    opponentRosterRows
      .filter((r) => r.playerId !== null)
      .map((r) => r.playerId!)
  );
}
