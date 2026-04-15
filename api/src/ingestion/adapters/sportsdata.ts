import type { IngestionAdapter, RawSignal } from "../types";
import type { PrismaClient } from "../../generated/prisma/client";

const SCORES_BASE = "https://api.sportsdata.io/v3/nfl/scores/json";
const STATS_BASE = "https://api.sportsdata.io/v3/nfl/stats/json";

// Minimum PPR fantasy points to be worth emitting as a signal
const MIN_FANTASY_POINTS = 5;

interface PlayerGameStats {
  PlayerID: number;
  Name: string;
  Team: string | null;
  Position: string | null;
  Week: number;
  Season: number;
  // Passing
  PassingYards: number | null;
  PassingTouchdowns: number | null;
  PassingInterceptions: number | null;
  // Rushing
  RushingAttempts: number | null;
  RushingYards: number | null;
  RushingTouchdowns: number | null;
  // Receiving
  Receptions: number | null;
  Targets: number | null;
  ReceivingYards: number | null;
  ReceivingTouchdowns: number | null;
  // Fantasy
  FantasyPoints: number | null;
  FantasyPointsPPR: number | null;
}

export class SportsdataAdapter implements IngestionAdapter {
  readonly source = "SPORTSDATA" as const;

  constructor(
    private readonly apiKey: string,
    private readonly prisma: PrismaClient
  ) {}

  async fetchSignals(): Promise<RawSignal[]> {
    const [season, week] = await Promise.all([
      this.fetchCurrentSeason(),
      this.fetchCurrentWeek(),
    ]);

    // week 0 = preseason/offseason; week > 18 = postseason (not modeled here)
    if (!season || !week || week < 1 || week > 18) return [];

    const playerStats = await this.fetchPlayerGameStats(season, week);
    const seenKeys = await this.loadSeenKeys();

    const signals: RawSignal[] = [];

    for (const player of playerStats) {
      if (!player.Name) continue;
      if (!this.hasFantasyRelevantStats(player)) continue;

      const dedupeKey = `${player.PlayerID}:${season}:${week}`;
      if (seenKeys.has(dedupeKey)) continue;

      signals.push({
        rawPlayerName: player.Name,
        source: "SPORTSDATA",
        signalType: "STATS_UPDATE",
        content: this.buildContent(player),
        metadata: {
          dedupeKey,
          season,
          week,
          sportsdataId: player.PlayerID,
          fantasyPointsPPR: player.FantasyPointsPPR,
          fantasyPoints: player.FantasyPoints,
        },
        publishedAt: new Date(),
      });
    }

    return signals;
  }

  buildContent(player: PlayerGameStats): string {
    const parts: string[] = [];
    const pos = player.Position?.toUpperCase();

    if (pos === "QB" && player.PassingYards != null) {
      parts.push(`${player.PassingYards} pass yds`);
      if (player.PassingTouchdowns) parts.push(`${player.PassingTouchdowns} TD`);
      if (player.PassingInterceptions) parts.push(`${player.PassingInterceptions} INT`);
    }

    if ((pos === "RB" || pos === "QB") && player.RushingYards != null && player.RushingYards > 0) {
      parts.push(`${player.RushingYards} rush yds`);
      if (player.RushingTouchdowns) parts.push(`${player.RushingTouchdowns} rush TD`);
    }

    if ((pos === "WR" || pos === "TE" || pos === "RB") && player.Receptions != null) {
      parts.push(`${player.Receptions}/${player.Targets ?? "?"} rec`);
      if (player.ReceivingYards != null) parts.push(`${player.ReceivingYards} yds`);
      if (player.ReceivingTouchdowns) parts.push(`${player.ReceivingTouchdowns} TD`);
    }

    const statLine = parts.length > 0 ? parts.join(", ") : "stats available";
    const pprStr = player.FantasyPointsPPR != null
      ? ` (${player.FantasyPointsPPR.toFixed(1)} PPR pts)`
      : "";

    return `${player.Name} Week ${player.Week}: ${statLine}${pprStr}`;
  }

  hasFantasyRelevantStats(player: PlayerGameStats): boolean {
    const ppr = player.FantasyPointsPPR ?? player.FantasyPoints ?? 0;
    return ppr >= MIN_FANTASY_POINTS;
  }

  private async fetchCurrentSeason(): Promise<number | null> {
    const res = await this.get(`${SCORES_BASE}/CurrentSeason`);
    const val = await res.json() as number | null;
    return typeof val === "number" ? val : null;
  }

  private async fetchCurrentWeek(): Promise<number | null> {
    const res = await this.get(`${SCORES_BASE}/CurrentWeek`);
    const val = await res.json() as number | null;
    return typeof val === "number" ? val : null;
  }

  private async fetchPlayerGameStats(season: number, week: number): Promise<PlayerGameStats[]> {
    const res = await this.get(`${STATS_BASE}/PlayerGameStatsByWeek/${season}/${week}`);
    return res.json() as Promise<PlayerGameStats[]>;
  }

  private async get(url: string): Promise<Response> {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}key=${this.apiKey}`);
    if (!res.ok) throw new Error(`SportsDataIO fetch failed: ${res.status} ${url}`);
    return res;
  }

  private async loadSeenKeys(): Promise<Set<string>> {
    const recent = await this.prisma.signal.findMany({
      where: { source: "SPORTSDATA" },
      select: { metadata: true },
      orderBy: { fetchedAt: "desc" },
      take: 500,
    });

    const keys = new Set<string>();
    for (const s of recent) {
      const meta = s.metadata as Record<string, unknown> | null;
      if (typeof meta?.dedupeKey === "string") keys.add(meta.dedupeKey);
    }
    return keys;
  }
}
