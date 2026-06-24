import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient } from "../../../generated/prisma/client";
import { BlueskyAdapter } from "../bluesky";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMockPrisma(knownPlayers: Record<string, string> = {}): PrismaClient {
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
      findMany: vi.fn(() => Promise.resolve([])),
    },
  } as unknown as PrismaClient;
}

function makeBskyPost(overrides: Partial<{ uri: string; cid: string; text: string; createdAt: string }> = {}) {
  return {
    uri: overrides.uri ?? "at://did:plc:abc/app.bsky.feed.post/123",
    cid: overrides.cid ?? "bafyreiabc",
    record: {
      text: overrides.text ?? "Test post",
      createdAt: overrides.createdAt ?? new Date().toISOString(),
    },
  };
}

// ─── Player extraction ────────────────────────────────────────────────────────

describe("BlueskyAdapter — player name extraction", () => {
  const knownPlayers: Record<string, string> = {
    "patrick mahomes": "player-mahomes",
    "jaylen warren": "player-warren",
    "bijan robinson": "player-bijan",
  };

  let adapter: BlueskyAdapter;

  beforeEach(() => {
    adapter = new BlueskyAdapter(buildMockPrisma(knownPlayers));
  });

  it("extracts a player name from post text", async () => {
    const result = await (adapter as any).extractPlayerNames(
      "Patrick Mahomes looking sharp in OTAs"
    );
    expect(result).toContain("Patrick Mahomes");
  });

  it("extracts multiple distinct players from one post", async () => {
    const result = await (adapter as any).extractPlayerNames(
      "Jaylen Warren worth adding after Bijan Robinson injury update"
    );
    expect(result).toContain("Jaylen Warren");
    expect(result).toContain("Bijan Robinson");
  });

  it("returns empty array when no known players mentioned", async () => {
    const result = await (adapter as any).extractPlayerNames(
      "What is everyone's waiver strategy this week?"
    );
    expect(result).toHaveLength(0);
  });

  it("deduplicates repeated mentions of the same player", async () => {
    const result = await (adapter as any).extractPlayerNames(
      "Patrick Mahomes is great, Patrick Mahomes will dominate"
    );
    const count = result.filter((s: string) => s === "Patrick Mahomes").length;
    expect(count).toBe(1);
  });

  it("ignores all-lowercase tokens that cannot be player names", async () => {
    const result = await (adapter as any).extractPlayerNames(
      "great game today with awesome plays happening"
    );
    expect(result).toHaveLength(0);
  });
});

// ─── URI deduplication ────────────────────────────────────────────────────────

describe("BlueskyAdapter — URI deduplication", () => {
  it("loads seen URIs from stored signal metadata", async () => {
    const seenUri = "at://did:plc:abc/app.bsky.feed.post/999";
    const mockPrisma = {
      signal: {
        findMany: vi.fn(() =>
          Promise.resolve([{ metadata: { postUri: seenUri } }])
        ),
      },
    } as unknown as PrismaClient;

    const adapter = new BlueskyAdapter(mockPrisma);
    const seen = await (adapter as any).loadSeenUris();
    expect(seen.has(seenUri)).toBe(true);
  });

  it("returns empty set when no BLUESKY signals exist yet", async () => {
    const mockPrisma = {
      signal: { findMany: vi.fn(() => Promise.resolve([])) },
    } as unknown as PrismaClient;

    const adapter = new BlueskyAdapter(mockPrisma);
    const seen = await (adapter as any).loadSeenUris();
    expect(seen.size).toBe(0);
  });
});

// ─── fetchAuthorFeed ─────────────────────────────────────────────────────────

describe("BlueskyAdapter — fetchAuthorFeed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the AT Protocol public API with correct params", async () => {
    const post = makeBskyPost();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ feed: [{ post }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new BlueskyAdapter(buildMockPrisma());
    const posts = await (adapter as any).fetchAuthorFeed("adamschefter.bsky.social");

    expect(posts).toHaveLength(1);
    expect(posts[0].uri).toBe(post.uri);

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed");
    expect(calledUrl).toContain("actor=adamschefter.bsky.social");
    expect(calledUrl).toContain("filter=posts_no_replies");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const adapter = new BlueskyAdapter(buildMockPrisma());
    await expect((adapter as any).fetchAuthorFeed("unknown.bsky.social"))
      .rejects.toThrow("Bluesky API error 404");
  });
});

// ─── fetchSignals (integration via mocked fetch) ──────────────────────────────

describe("BlueskyAdapter — fetchSignals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips posts with URIs already seen", async () => {
    const seenUri = "at://did:plc:abc/app.bsky.feed.post/seen";
    const post = makeBskyPost({ uri: seenUri, text: "Patrick Mahomes news" });

    const mockPrisma = {
      playerNameAlias: {
        findUnique: vi.fn(() => Promise.resolve({ playerId: "player-mahomes" })),
        upsert: vi.fn(),
      },
      player: {
        findFirst: vi.fn(() => Promise.resolve({ id: "player-mahomes" })),
        findMany: vi.fn(() => Promise.resolve([{ id: "player-mahomes", fullName: "Patrick Mahomes" }])),
      },
      signal: {
        findMany: vi.fn(() => Promise.resolve([{ metadata: { postUri: seenUri } }])),
      },
    } as unknown as PrismaClient;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ feed: [{ post }] }),
    }));

    const adapter = new BlueskyAdapter(mockPrisma);
    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0);
  });

  it("degrades gracefully when an account fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const adapter = new BlueskyAdapter(buildMockPrisma());
    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0);
  });

  it("degrades gracefully when fetch throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const adapter = new BlueskyAdapter(buildMockPrisma());
    const signals = await adapter.fetchSignals();
    expect(signals).toHaveLength(0);
  });
});
