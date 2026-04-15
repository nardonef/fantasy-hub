import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "../../../generated/prisma/client";
import { RedditAdapter } from "../reddit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Prisma mock that resolves a fixed set of player names. */
function buildMockPrisma(knownPlayers: Record<string, string>): PrismaClient {
  return {
    playerNameAlias: {
      findUnique: vi.fn(({ where }: { where: { alias: string } }) => {
        const playerId = knownPlayers[where.alias.toLowerCase()];
        return Promise.resolve(playerId ? { playerId } : null);
      }),
      upsert: vi.fn(() => Promise.resolve({})),
    },
    player: {
      findFirst: vi.fn(({ where }: { where: { fullName: { equals: string } } }) => {
        const key = where.fullName.equals.toLowerCase();
        const playerId = knownPlayers[key];
        return Promise.resolve(playerId ? { id: playerId } : null);
      }),
      findMany: vi.fn(() =>
        Promise.resolve(
          Object.entries(knownPlayers).map(([fullName, id]) => ({ id, fullName }))
        )
      ),
    },
    signal: {
      findMany: vi.fn(() => Promise.resolve([])), // no seen post IDs
    },
  } as unknown as PrismaClient;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RedditAdapter — player name extraction", () => {
  const knownPlayers: Record<string, string> = {
    "patrick mahomes": "player-mahomes",
    "jaylen warren": "player-warren",
    "bijan robinson": "player-bijan",
  };

  let adapter: RedditAdapter;

  beforeEach(() => {
    adapter = new RedditAdapter(buildMockPrisma(knownPlayers));
  });

  it("extracts a player name from a simple title", async () => {
    const signals = await (adapter as any).extractPlayerIds(
      "Patrick Mahomes looking sharp in OTAs this week"
    );
    expect(signals).toContain("Patrick Mahomes");
  });

  it("extracts multiple distinct players from one title", async () => {
    const signals = await (adapter as any).extractPlayerIds(
      "Jaylen Warren worth adding after Bijan Robinson injury update"
    );
    expect(signals).toContain("Jaylen Warren");
    expect(signals).toContain("Bijan Robinson");
  });

  it("returns no results when no known players are mentioned", async () => {
    const signals = await (adapter as any).extractPlayerIds(
      "What is everyone's waiver strategy this week?"
    );
    expect(signals).toHaveLength(0);
  });

  it("deduplicates repeated mentions of the same player", async () => {
    const signals = await (adapter as any).extractPlayerIds(
      "Patrick Mahomes is great, Patrick Mahomes will dominate"
    );
    const count = signals.filter((s: string) => s === "Patrick Mahomes").length;
    expect(count).toBe(1);
  });

  it("does not extract single lowercase tokens as player names", async () => {
    const signals = await (adapter as any).extractPlayerIds(
      "great game today with awesome plays"
    );
    expect(signals).toHaveLength(0);
  });
});

describe("RedditAdapter — post ID deduplication", () => {
  it("skips posts whose IDs are already in the seen set", async () => {
    const seenId = "abc123";
    const mockPrisma = {
      playerNameAlias: { findUnique: vi.fn(), upsert: vi.fn() },
      player: { findFirst: vi.fn(), findMany: vi.fn(() => Promise.resolve([])) },
      signal: {
        findMany: vi.fn(() =>
          Promise.resolve([{ metadata: { postId: seenId } }])
        ),
      },
    } as unknown as PrismaClient;

    const adapter = new RedditAdapter(mockPrisma);
    const seen = await (adapter as any).loadSeenPostIds();
    expect(seen.has(seenId)).toBe(true);
  });

  it("returns an empty set when no signals exist yet", async () => {
    const mockPrisma = {
      signal: { findMany: vi.fn(() => Promise.resolve([])) },
    } as unknown as PrismaClient;

    const adapter = new RedditAdapter(mockPrisma);
    const seen = await (adapter as any).loadSeenPostIds();
    expect(seen.size).toBe(0);
  });
});

describe("RedditAdapter — fetchSubredditPosts", () => {
  it("calls the public JSON endpoint without auth headers", async () => {
    const post = {
      id: "post1",
      title: "Test post",
      selftext: "",
      score: 100,
      num_comments: 5,
      created_utc: Math.floor(Date.now() / 1000),
      url: "https://reddit.com/r/fantasyfootball/post1",
      permalink: "/r/fantasyfootball/comments/post1/test_post/",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { children: [{ data: post }] } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const mockPrisma = {
      signal: { findMany: vi.fn(() => Promise.resolve([])) },
    } as unknown as PrismaClient;

    const adapter = new RedditAdapter(mockPrisma);
    const posts = await (adapter as any).fetchSubredditPosts("fantasyfootball");

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe("post1");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("www.reddit.com/r/fantasyfootball/hot.json");
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
    expect((init.headers as Record<string, string>)["User-Agent"]).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("throws on non-OK response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal("fetch", mockFetch);

    const mockPrisma = {
      signal: { findMany: vi.fn(() => Promise.resolve([])) },
    } as unknown as PrismaClient;

    const adapter = new RedditAdapter(mockPrisma);
    await expect((adapter as any).fetchSubredditPosts("fantasyfootball"))
      .rejects.toThrow("Reddit API error 429");

    vi.unstubAllGlobals();
  });
});
