import type { IngestionAdapter, RawSignal } from "../types";
import type { PrismaClient } from "../../generated/prisma/client";
import { resolvePlayer } from "../player-resolution";

/**
 * Curated list of fantasy-relevant Twitter accounts to follow.
 * Beat reporters for injury/transaction news + top fantasy analysts.
 */
const ACCOUNTS = [
  // NFL beat reporters
  "AdamSchefter",
  "RapSheet",
  "TomPelissero",
  "MikeGarafolo",
  "JordanRaanan",
  // Fantasy analysts
  "FantasyPros",
  "FFBallBobby",
  "WaiverWireKing",
  "PFF_Fantasy",
  "TheFFBallers",
  "JakeTrowbridge",
];

/**
 * Public Nitter instances to try in order. Nitter provides RSS feeds at
 * /:user/rss without requiring authentication. Falls back through the list
 * if an instance is unreachable.
 */
const NITTER_INSTANCES = [
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.1d4.us",
];

interface ParsedTweet {
  id: string;
  text: string;
  pubDate: Date;
}

export class TwitterAdapter implements IngestionAdapter {
  readonly source = "TWITTER" as const;

  constructor(private readonly prisma: PrismaClient) {}

  async fetchSignals(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const seenTweetIds = await this.loadSeenTweetIds();
    const nitterBase = await this.resolveNitterInstance();

    if (!nitterBase) {
      console.warn("[TwitterAdapter] all Nitter instances unreachable — skipping");
      return [];
    }

    for (const account of ACCOUNTS) {
      let tweets: ParsedTweet[];
      try {
        tweets = await this.fetchAccountTweets(nitterBase, account);
      } catch (err) {
        console.warn(`[TwitterAdapter] skipping @${account}: ${(err as Error).message}`);
        continue;
      }

      for (const tweet of tweets) {
        if (seenTweetIds.has(tweet.id)) continue;

        const playerNames = await this.extractPlayerNames(tweet.text);
        for (const rawPlayerName of playerNames) {
          signals.push({
            rawPlayerName,
            source: "TWITTER",
            signalType: "SOCIAL_MENTION",
            content: tweet.text,
            metadata: {
              tweetId: tweet.id,
              account,
              nitterInstance: nitterBase,
            },
            publishedAt: tweet.pubDate,
          });
        }
      }
    }

    return signals;
  }

  /**
   * Try each Nitter instance with a lightweight probe request.
   * Returns the first reachable base URL, or null if all are down.
   */
  private async resolveNitterInstance(): Promise<string | null> {
    for (const base of NITTER_INSTANCES) {
      try {
        const res = await fetch(`${base}/FantasyPros/rss`, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "FantasyHub/1.0" },
        });
        if (res.ok || res.status === 200) return base;
      } catch {
        // Try next instance
      }
    }
    return null;
  }

  private async fetchAccountTweets(nitterBase: string, account: string): Promise<ParsedTweet[]> {
    const res = await fetch(`${nitterBase}/${account}/rss`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "FantasyHub/1.0" },
    });

    if (!res.ok) {
      throw new Error(`Nitter RSS error ${res.status} for @${account}`);
    }

    const xml = await res.text();
    return this.parseRssXml(xml);
  }

  /**
   * Minimal RSS XML parser for Nitter's feed format.
   * Extracts <item> blocks and pulls title, pubDate, and guid.
   * Avoids adding an XML parser dependency — Nitter's RSS is well-structured.
   */
  private parseRssXml(xml: string): ParsedTweet[] {
    const items: ParsedTweet[] = [];
    const itemPattern = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemPattern.exec(xml)) !== null) {
      const block = match[1];

      const title = this.extractTag(block, "title");
      const pubDateStr = this.extractTag(block, "pubDate");
      const guid = this.extractTag(block, "guid");

      if (!title || !pubDateStr || !guid) continue;

      // Tweet ID is the last path segment of the status URL
      const tweetId = guid.split("/").pop() ?? guid;
      // Nitter wraps tweet text in CDATA; strip HTML tags and entities
      const text = this.cleanTweetText(title);
      const pubDate = new Date(pubDateStr);

      if (isNaN(pubDate.getTime())) continue;

      items.push({ id: tweetId, text, pubDate });
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    const pattern = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "s");
    const m = pattern.exec(xml);
    return m ? m[1].trim() : null;
  }

  private cleanTweetText(html: string): string {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Same n-gram player extraction logic as RedditAdapter.
   * Reuses the shared resolvePlayer pipeline.
   */
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
        const playerId = await resolvePlayer(candidate, "TWITTER", this.prisma);
        if (playerId) {
          found.add(candidate);
          break;
        }
      }
    }

    return Array.from(found);
  }

  private async loadSeenTweetIds(): Promise<Set<string>> {
    const recent = await this.prisma.signal.findMany({
      where: { source: "TWITTER" },
      select: { metadata: true },
      orderBy: { fetchedAt: "desc" },
      take: 1000,
    });

    const ids = new Set<string>();
    for (const s of recent) {
      const meta = s.metadata as Record<string, unknown> | null;
      if (meta?.tweetId && typeof meta.tweetId === "string") {
        ids.add(meta.tweetId);
      }
    }
    return ids;
  }
}
