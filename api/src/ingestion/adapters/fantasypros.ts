import type { IngestionAdapter, RawSignal } from "../types";
import type { PrismaClient } from "../../generated/prisma/client";


const ECR_URL = "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

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
    const seenFantasyProsIds = await this.loadSeenIds();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const signals: RawSignal[] = [];

    for (const player of ecrData.players) {
      // Dedup: only one signal per FantasyPros player ID per calendar day
      const dedupeKey = `${player.player_id}:${today}`;
      if (seenFantasyProsIds.has(dedupeKey)) continue;

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
          rankDelta: player.player_ecr_delta,
          lastUpdated: ecrData.last_updated,
        },
        publishedAt: new Date(),
      });
    }

    return signals;
  }

  private buildContent(player: EcrPlayer): string {
    const delta = player.player_ecr_delta;
    if (delta === null) {
      return `${player.player_name} ranked ${player.pos_rank} (overall #${player.rank_ecr})`;
    }
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

    // Find the end of the JS assignment: the `};` that closes the object literal.
    // The page may have additional `var x = ...` declarations before `</script>`,
    // so we cannot use `</script>` as the boundary — find `};` followed by whitespace
    // or a newline instead.
    const assignEnd = html.indexOf("};", jsonStart);
    if (assignEnd === -1) throw new Error("Could not find end of ecrData assignment");

    const json = html.slice(jsonStart, assignEnd + 1); // include the closing `}`

    return JSON.parse(json) as EcrData;
  }

  /** Load dedupeKeys already stored in signal metadata to skip re-ingestion. */
  private async loadSeenIds(): Promise<Set<string>> {
    const recent = await this.prisma.signal.findMany({
      where: { source: "FANTASYPROS" },
      select: { metadata: true },
      orderBy: { fetchedAt: "desc" },
      take: 1000,
    });

    const keys = new Set<string>();
    for (const s of recent) {
      const meta = s.metadata as Record<string, unknown> | null;
      if (typeof meta?.dedupeKey === "string") keys.add(meta.dedupeKey);
    }
    return keys;
  }
}
