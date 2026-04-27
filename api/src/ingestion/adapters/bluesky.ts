import type { IngestionAdapter, RawSignal } from "../types";
import type { PrismaClient } from "../../generated/prisma/client";
import { resolvePlayer } from "../player-resolution";

// Curated Bluesky handles — beat reporters + fantasy analysts active on Bluesky.
// Verified reachable via getAuthorFeed 2026-04-19.
const ACCOUNTS = [
  // NFL beat reporters
  "adamschefter.bsky.social",
  "rapsheet.bsky.social",
  "tompelissero.bsky.social",
  // Fantasy news aggregators / analysts
  "rotowire.bsky.social",
  "rotoworld.bsky.social",
  "fftoday.bsky.social",
  "nflonfox.bsky.social",
  "dynastynerds.bsky.social",
  "fantasypros.bsky.social",
];

const BSKY_API = "https://public.api.bsky.app/xrpc";
const POSTS_PER_ACCOUNT = 20;

interface BskyPost {
  uri: string;
  cid: string;
  record: {
    text: string;
    createdAt: string;
  };
}

interface BskyFeedResponse {
  feed: Array<{ post: BskyPost }>;
  cursor?: string;
}

export class BlueskyAdapter implements IngestionAdapter {
  readonly source = "BLUESKY" as const;

  constructor(private readonly prisma: PrismaClient) {}

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const seenUris = await this.loadSeenUris();

    for (const handle of ACCOUNTS) {
      let posts: BskyPost[];
      try {
        posts = await this.fetchAuthorFeed(handle);
      } catch (err) {
        console.warn(`[BlueskyAdapter] skipping @${handle}: ${(err as Error).message}`);
        continue;
      }

      for (const post of posts) {
        if (seenUris.has(post.uri)) continue;

        const text = post.record.text;
        const playerNames = await this.extractPlayerNames(text);

        for (const rawPlayerName of playerNames) {
          signals.push({
            rawPlayerName,
            source: "BLUESKY",
            signalType: "SOCIAL_MENTION",
            content: text,
            metadata: {
              postUri: post.uri,
              cid: post.cid,
              handle,
            },
            publishedAt: new Date(post.record.createdAt),
          });
        }
      }
    }

    return signals;
  }

  private async fetchAuthorFeed(handle: string): Promise<BskyPost[]> {
    const url = new URL(`${BSKY_API}/app.bsky.feed.getAuthorFeed`);
    url.searchParams.set("actor", handle);
    url.searchParams.set("limit", String(POSTS_PER_ACCOUNT));
    url.searchParams.set("filter", "posts_no_replies");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "FantasyHub/1.0" },
    });

    if (!res.ok) {
      throw new Error(`Bluesky API error ${res.status} for @${handle}`);
    }

    const data = (await res.json()) as BskyFeedResponse;
    return data.feed.map((item) => item.post);
  }

  private async extractPlayerNames(text: string): Promise<string[]> {
    const tokens = text
      .replace(/[^a-zA-Z\s'.-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const found = new Set<string>();

    for (let i = 0; i < tokens.length; i++) {
      for (const size of [3, 2]) {
        if (i + size > tokens.length) continue;
        const candidate = tokens.slice(i, i + size).join(" ");
        if (!/^[A-Z]/.test(tokens[i])) continue;
        const playerId = await resolvePlayer(candidate, "BLUESKY", this.prisma);
        if (playerId) {
          found.add(candidate);
          break;
        }
      }
    }

    return Array.from(found);
  }

  private async loadSeenUris(): Promise<Set<string>> {
    const recent = await this.prisma.signal.findMany({
      where: { source: "BLUESKY" },
      select: { metadata: true },
      orderBy: { fetchedAt: "desc" },
      take: 1000,
    });

    const uris = new Set<string>();
    for (const s of recent) {
      const meta = s.metadata as Record<string, unknown> | null;
      if (meta?.postUri && typeof meta.postUri === "string") {
        uris.add(meta.postUri);
      }
    }
    return uris;
  }
}
