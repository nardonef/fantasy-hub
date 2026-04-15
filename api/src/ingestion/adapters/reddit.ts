import type { IngestionAdapter, RawSignal } from "../types";
import type { PrismaClient } from "../../generated/prisma/client";
import { resolvePlayer } from "../player-resolution";

const SUBREDDITS = ["fantasyfootball", "DynastyFF", "fantasynfl"];
const POSTS_PER_SUB = 25;
// Minimum upvotes to bother ingesting — filters out noise
const MIN_UPVOTES = 50;

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
}

export class RedditAdapter implements IngestionAdapter {
  readonly source = "REDDIT" as const;

  constructor(private readonly prisma: PrismaClient) {}

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const seenPostIds = await this.loadSeenPostIds();

    for (const sub of SUBREDDITS) {
      let posts: RedditPost[];
      try {
        posts = await this.fetchSubredditPosts(sub);
      } catch (err) {
        console.warn(`[RedditAdapter] skipping r/${sub}: ${(err as Error).message}`);
        continue;
      }
      for (const post of posts) {
        if (seenPostIds.has(post.id)) continue;
        if (post.score < MIN_UPVOTES) continue;

        const playerIds = await this.extractPlayerIds(post.title + " " + post.selftext.slice(0, 500));
        for (const rawPlayerName of playerIds) {
          signals.push({
            rawPlayerName,
            source: "REDDIT",
            signalType: "SOCIAL_MENTION",
            content: post.title,
            metadata: {
              postId: post.id,
              score: post.score,
              numComments: post.num_comments,
              subreddit: sub,
              permalink: `https://reddit.com${post.permalink}`,
            },
            publishedAt: new Date(post.created_utc * 1000),
          });
        }
      }
    }

    return signals;
  }

  private async fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${POSTS_PER_SUB}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FantasyHub/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Reddit API error ${res.status} for r/${subreddit}`);
    }

    const data = await res.json() as { data: { children: Array<{ data: RedditPost }> } };
    return data.data.children.map((c) => c.data);
  }

  /**
   * Scans text for player name matches by testing 2-gram and 3-gram spans
   * against the player resolution pipeline. Returns deduplicated raw name strings.
   */
  private async extractPlayerIds(text: string): Promise<string[]> {
    const tokens = text
      .replace(/[^a-zA-Z\s'.-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const found = new Set<string>();

    for (let i = 0; i < tokens.length; i++) {
      for (const size of [3, 2]) {
        if (i + size > tokens.length) continue;
        const candidate = tokens.slice(i, i + size).join(" ");
        // Quick pre-filter: first token must start with uppercase
        if (!/^[A-Z]/.test(tokens[i])) continue;
        const playerId = await resolvePlayer(candidate, "REDDIT", this.prisma);
        if (playerId) {
          found.add(candidate);
          break; // Don't double-count overlapping spans
        }
      }
    }

    return Array.from(found);
  }

  /** Load Reddit post IDs already stored in signal metadata to skip re-ingestion. */
  private async loadSeenPostIds(): Promise<Set<string>> {
    const recent = await this.prisma.signal.findMany({
      where: { source: "REDDIT" },
      select: { metadata: true },
      orderBy: { fetchedAt: "desc" },
      take: 500,
    });

    const ids = new Set<string>();
    for (const s of recent) {
      const meta = s.metadata as Record<string, unknown> | null;
      if (meta?.postId && typeof meta.postId === "string") {
        ids.add(meta.postId);
      }
    }
    return ids;
  }
}
