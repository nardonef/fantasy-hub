import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../../lib/prisma";
import { createTestApp } from "../../lib/test-app";

// ─── Mock auth ────────────────────────────────────────────────────────────────
vi.mock("../../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.dbUser = { id: "test-user-players" };
    next();
  },
  requireLeagueMember: (_req: any, _res: any, next: any) => next(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const app = createTestApp();

let playerId: string;
let signalId: string;

beforeAll(async () => {
  await prisma.signal.deleteMany({ where: { player: { fullName: "__PlayersTestPlayer__" } } });
  await prisma.player.deleteMany({ where: { fullName: "__PlayersTestPlayer__" } });

  const player = await prisma.player.create({
    data: { fullName: "__PlayersTestPlayer__", position: "QB", nflTeam: "KC" },
  });
  playerId = player.id;

  const signal = await prisma.signal.create({
    data: {
      playerId,
      source: "FANTASYPROS",
      signalType: "RANKING_CHANGE",
      content: "__PlayersTestPlayer__ ranked QB1 (overall #1)",
      metadata: { rankEcr: 1, posRank: "QB1" },
      publishedAt: new Date(),
    },
  });
  signalId = signal.id;
});

afterAll(async () => {
  await prisma.signal.deleteMany({ where: { playerId } });
  await prisma.player.deleteMany({ where: { id: playerId } });
});

// ─── GET /api/players/search ──────────────────────────────────────────────────

describe("GET /api/players/search", () => {
  it("returns 200 with matching players", async () => {
    const res = await request(app).get("/api/players/search?q=__PlayersTest");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.players)).toBe(true);
    const names = res.body.players.map((p: any) => p.fullName);
    expect(names).toContain("__PlayersTestPlayer__");
  });

  it("search is case-insensitive", async () => {
    const res = await request(app).get("/api/players/search?q=__playerstest");
    expect(res.status).toBe(200);
    const names = res.body.players.map((p: any) => p.fullName);
    expect(names).toContain("__PlayersTestPlayer__");
  });

  it("returns 400 when query is shorter than 2 chars", async () => {
    const res = await request(app).get("/api/players/search?q=X");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 2/i);
  });

  it("returns 400 when query is missing", async () => {
    const res = await request(app).get("/api/players/search");
    expect(res.status).toBe(400);
  });

  it("returns at most 10 results", async () => {
    // Use a common substring guaranteed to match many real players
    const res = await request(app).get("/api/players/search?q=son");
    expect(res.status).toBe(200);
    expect(res.body.players.length).toBeLessThanOrEqual(10);
  });

  it("each result has id, fullName, position, nflTeam, status", async () => {
    const res = await request(app).get("/api/players/search?q=__PlayersTest");
    const player = res.body.players[0];
    expect(player).toHaveProperty("id");
    expect(player).toHaveProperty("fullName");
    expect(player).toHaveProperty("position");
    expect(player).toHaveProperty("nflTeam");
    expect(player).toHaveProperty("status");
  });
});

// ─── GET /api/players/:playerId ───────────────────────────────────────────────

describe("GET /api/players/:playerId", () => {
  it("returns 200 with player and signals array", async () => {
    const res = await request(app).get(`/api/players/${playerId}`);
    expect(res.status).toBe(200);
    expect(res.body.player.id).toBe(playerId);
    expect(res.body.player.fullName).toBe("__PlayersTestPlayer__");
    expect(Array.isArray(res.body.player.signals)).toBe(true);
  });

  it("includes the seeded signal", async () => {
    const res = await request(app).get(`/api/players/${playerId}`);
    const ids = res.body.player.signals.map((s: any) => s.id);
    expect(ids).toContain(signalId);
  });

  it("signals are ordered by publishedAt descending", async () => {
    const older = await prisma.signal.create({
      data: {
        playerId,
        source: "REDDIT",
        signalType: "SOCIAL_MENTION",
        content: "older signal",
        metadata: {},
        publishedAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).get(`/api/players/${playerId}`);
    const dates = res.body.player.signals.map((s: any) => new Date(s.publishedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }

    await prisma.signal.delete({ where: { id: older.id } });
  });

  it("returns 404 for a non-existent player ID", async () => {
    const res = await request(app).get("/api/players/nonexistent-player-id-xyz");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
