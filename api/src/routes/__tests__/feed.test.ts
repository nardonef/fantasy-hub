import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../../lib/prisma";
import { createTestApp } from "../../lib/test-app";

// Mock roster helper — default returns null (no roster filter); overridden per test
vi.mock("../../lib/roster", () => ({
  getRosterPlayerIds: vi.fn().mockResolvedValue(null),
}));
import { getRosterPlayerIds } from "../../lib/roster";

// ─── Mock auth ────────────────────────────────────────────────────────────────
// Bypass requireAuth and requireLeagueMember — inject fake user + membership
vi.mock("../../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.dbUser = { id: "test-user-feed" };
    next();
  },
  requireLeagueMember: (_req: any, _res: any, next: any) => next(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LEAGUE_ID = "test-league-feed-001";
const app = createTestApp();

let playerId: string;
let signalId: string;

beforeAll(async () => {
  // Clean up any leftovers
  await prisma.signal.deleteMany({ where: { player: { fullName: "__FeedTestPlayer__" } } });
  await prisma.player.deleteMany({ where: { fullName: "__FeedTestPlayer__" } });

  const player = await prisma.player.create({
    data: { fullName: "__FeedTestPlayer__", position: "WR", nflTeam: "SF" },
  });
  playerId = player.id;

  const signal = await prisma.signal.create({
    data: {
      playerId,
      source: "FANTASYPROS",
      signalType: "RANKING_CHANGE",
      content: "__FeedTestPlayer__ ↑2 to WR10 (overall #22)",
      metadata: { rankEcr: 22, posRank: "WR10" },
      publishedAt: new Date(),
    },
  });
  signalId = signal.id;
});

afterAll(async () => {
  await prisma.signal.deleteMany({ where: { playerId } });
  await prisma.player.deleteMany({ where: { id: playerId } });
});

// ─── GET /api/leagues/:leagueId/feed ─────────────────────────────────────────

describe("GET /api/leagues/:leagueId/feed", () => {
  it("returns 200 with signals array and nextCursor", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.signals)).toBe(true);
    expect("nextCursor" in res.body).toBe(true);
  });

  it("includes the seeded signal in the response", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed`);
    const ids = res.body.signals.map((s: any) => s.id);
    expect(ids).toContain(signalId);
  });

  it("each signal includes joined player data", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed`);
    const signal = res.body.signals.find((s: any) => s.id === signalId);
    expect(signal?.player?.fullName).toBe("__FeedTestPlayer__");
    expect(signal?.player?.position).toBe("WR");
  });

  it("filters by source", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?source=FANTASYPROS`);
    expect(res.status).toBe(200);
    for (const s of res.body.signals) {
      expect(s.source).toBe("FANTASYPROS");
    }
  });

  it("filters by signalType", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?type=RANKING_CHANGE`);
    expect(res.status).toBe(200);
    for (const s of res.body.signals) {
      expect(s.signalType).toBe("RANKING_CHANGE");
    }
  });

  it("filters by playerId", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?playerId=${playerId}`);
    expect(res.status).toBe(200);
    expect(res.body.signals.length).toBeGreaterThan(0);
    for (const s of res.body.signals) {
      expect(s.playerId).toBe(playerId);
    }
  });

  it("returns 400 for invalid source", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?source=BOGUS`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid source/i);
  });

  it("returns 400 for invalid type", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?type=BOGUS`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid type/i);
  });

  it("filters by position", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?position=WR`);
    expect(res.status).toBe(200);
    for (const s of res.body.signals) {
      expect(s.player.position).toBe("WR");
    }
  });

  it("returns 400 for invalid position", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?position=LB`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid position/i);
  });

  it("myRosterOnly=true restricts to player IDs from getRosterPlayerIds", async () => {
    vi.mocked(getRosterPlayerIds).mockResolvedValueOnce(new Set([playerId]));
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?myRosterOnly=true`);
    expect(res.status).toBe(200);
    expect(res.body.signals.length).toBeGreaterThan(0);
    for (const s of res.body.signals) {
      expect(s.playerId).toBe(playerId);
    }
  });

  it("myRosterOnly=true with empty roster returns no signals", async () => {
    vi.mocked(getRosterPlayerIds).mockResolvedValueOnce(new Set());
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?myRosterOnly=true`);
    expect(res.status).toBe(200);
    expect(res.body.signals).toHaveLength(0);
  });

  it("myRosterOnly=true with null roster (non-Sleeper) shows all signals", async () => {
    vi.mocked(getRosterPlayerIds).mockResolvedValueOnce(null);
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?myRosterOnly=true`);
    expect(res.status).toBe(200);
    const ids = res.body.signals.map((s: any) => s.id);
    expect(ids).toContain(signalId);
  });

  it("respects the limit param", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?limit=1`);
    expect(res.status).toBe(200);
    expect(res.body.signals.length).toBeLessThanOrEqual(1);
  });

  it("cursor pagination: second page excludes items from first", async () => {
    // Seed a second signal so we have at least 2
    const sig2 = await prisma.signal.create({
      data: {
        playerId,
        source: "REDDIT",
        signalType: "SOCIAL_MENTION",
        content: "__FeedTestPlayer__ buzz",
        metadata: {},
        publishedAt: new Date(Date.now() - 1000),
        fetchedAt: new Date(Date.now() - 1000),
      },
    });

    const page1 = await request(app).get(`/api/leagues/${LEAGUE_ID}/feed?limit=1`);
    expect(page1.status).toBe(200);
    expect(page1.body.nextCursor).not.toBeNull();

    const page2 = await request(app).get(
      `/api/leagues/${LEAGUE_ID}/feed?limit=1&cursor=${encodeURIComponent(page1.body.nextCursor)}`
    );
    expect(page2.status).toBe(200);
    const page1Ids = page1.body.signals.map((s: any) => s.id);
    const page2Ids = page2.body.signals.map((s: any) => s.id);
    // No overlap between pages
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);

    await prisma.signal.delete({ where: { id: sig2.id } });
  });
});

// ─── GET /api/leagues/:leagueId/recommendations ───────────────────────────────

describe("GET /api/leagues/:leagueId/recommendations", () => {
  it("returns 200 with recommendations array and since", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/recommendations`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(typeof res.body.since).toBe("string");
  });

  it("each recommendation has player, signalCount, confidence, sources, latestSignal", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/recommendations`);
    if (res.body.recommendations.length > 0) {
      const rec = res.body.recommendations[0];
      expect(rec).toHaveProperty("player");
      expect(rec).toHaveProperty("signalCount");
      expect(rec).toHaveProperty("confidence");
      expect(Array.isArray(rec.sources)).toBe(true);
      expect(rec).toHaveProperty("latestSignal");
    }
  });

  it("respects the limit param", async () => {
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/recommendations?limit=1`);
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(1);
  });

  it("confidence equals number of distinct sources for a player", async () => {
    // The seeded player has 1 FANTASYPROS signal — confidence should be 1
    const res = await request(app).get(`/api/leagues/${LEAGUE_ID}/recommendations`);
    const rec = res.body.recommendations.find((r: any) => r.player.id === playerId);
    if (rec) {
      expect(rec.confidence).toBe(rec.sources.length);
    }
  });
});
