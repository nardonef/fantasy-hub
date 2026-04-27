import type { IngestionAdapter, RawSignal } from "../types";
import type { PrismaClient } from "../../generated/prisma/client";

const ECR_URL = "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// Only surface a signal when the ECR rank moves this many spots or more.
const CRITICAL_DELTA_THRESHOLD = 10;

interface EcrPlayer {
  player_id: number;
  player_name: string;
  player_team_id: string | null;
  player_position_id: string;
  rank_ecr: number;
  pos_rank: string;   // e.g. "WR4"
  player_ecr_delta: number | null; // FantasyPros-computed change from prior day
}

interface EcrData {
  players: EcrPlayer[];
  last_updated: string;
}

export class FantasyProsAdapter implements IngestionAdapter {
  readonly source = "FANTASYPROS" as const;

  constructor(private readonly prisma: PrismaClient) {}

  async fetchSignals(): Promise<RawSignal[]> {
    const ecrData = await this.fetchEcrData();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Upsert daily snapshots for ALL players (powers the ranking trend chart).
    // This runs regardless of whether a signal is emitted.
    await this.upsertSnapshots(ecrData.players, today);

    // Load dedupe keys to avoid emitting duplicate signals on the same day.
    const seenKeys = await this.loadSeenKeys();

    const signals: RawSignal[] = [];

    for (const player of ecrData.players) {
      const delta = player.player_ecr_delta;

      // Only surface moves that cross the critical threshold.
      if (delta === null || Math.abs(delta) < CRITICAL_DELTA_THRESHOLD) continue;

      const dedupeKey = `${player.player_id}:${today}`;
      if (seenKeys.has(dedupeKey)) continue;

      signals.push({
        rawPlayerName: player.player_name,
        source: "FANTASYPROS",
        signalType: "RANKING_CHANGE",
        content: this.buildContent(player),
        metadata: {
          fantasyprosId: player.player_id,
          dedupeKey,
          rankEcr: player.rank_ecr,
          posRank: player.pos_rank,
          rankDelta: delta,
          lastUpdated: ecrData.last_updated,
        },
        publishedAt: new Date(),
      });
    }

    return signals;
  }

  private async upsertSnapshots(players: EcrPlayer[], date: string): Promise<void> {
    // Resolve player IDs for all players in the ECR list in one query.
    const names = players.map((p) => p.player_name);
    const rows = await this.prisma.player.findMany({
      where: { fullName: { in: names } },
      select: { id: true, fullName: true },
    });
    const nameToId = new Map(rows.map((r) => [r.fullName, r.id]));

    const ops = players
      .map((p) => ({ p, playerId: nameToId.get(p.player_name) }))
      .filter((x): x is { p: EcrPlayer; playerId: string } => x.playerId !== undefined);

    await Promise.all(
      ops.map(({ p, playerId }) =>
        this.prisma.playerRankingSnapshot.upsert({
          where: { playerId_source_date: { playerId, source: "FANTASYPROS", date } },
          create: {
            playerId,
            source: "FANTASYPROS",
            date,
            rankEcr: p.rank_ecr,
            posRank: p.pos_rank,
            rankDelta: p.player_ecr_delta,
          },
          update: {
            rankEcr: p.rank_ecr,
            posRank: p.pos_rank,
            rankDelta: p.player_ecr_delta,
          },
        })
      )
    );
  }

  buildContent(player: EcrPlayer): string {
    const delta = player.player_ecr_delta!;
    const direction = delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;
    return `${player.player_name} ${direction} to ${player.pos_rank} (overall #${player.rank_ecr})`;
  }

  private async fetchEcrData(): Promise<EcrData> {
    const res = await fetch(ECR_URL, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`FantasyPros fetch failed: ${res.status}`);
    const html = await res.text();
    return this.parseEcrData(html);
  }

  parseEcrData(html: string): EcrData {
    const marker = "var ecrData = ";
    const start = html.indexOf(marker);
    if (start === -1) throw new Error("ecrData variable not found in FantasyPros page");
    const jsonStart = start + marker.length;
    const assignEnd = html.indexOf("};", jsonStart);
    if (assignEnd === -1) throw new Error("Could not find end of ecrData assignment");
    return JSON.parse(html.slice(jsonStart, assignEnd + 1)) as EcrData;
  }

  private async loadSeenKeys(): Promise<Set<string>> {
    const recent = await this.prisma.signal.findMany({
      where: { source: "FANTASYPROS" },
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
