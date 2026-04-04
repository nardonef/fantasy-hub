import { Router } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { getValidYahooToken } from "../lib/yahoo-tokens";
import { requireAuth, requireLeagueMember } from "../middleware/auth";
import { syncQueue } from "../jobs/sync-league";
import { getAdapter } from "../providers";

const router = Router();

/** GET /api/leagues — list user's leagues */
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const memberships = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    include: {
      league: {
        include: {
          seasons: { select: { year: true, status: true }, orderBy: { year: "desc" } },
          _count: { select: { managers: true } },
        },
      },
    },
  });

  res.json(memberships.map((m: any) => ({
    id: m.league.id,
    name: m.league.name,
    provider: m.league.provider,
    role: m.role,
    teamCount: m.league.teamCount,
    scoringType: m.league.scoringType,
    seasons: m.league.seasons,
    managerCount: m.league._count.managers,
  })));
});

/** POST /api/leagues/discover — discover leagues from a provider */
router.post("/discover", requireAuth, async (req, res) => {
  const { provider, credentials } = req.body;
  if (!provider || !credentials) {
    res.status(400).json({ error: "provider and credentials required" });
    return;
  }

  try {
    const adapter = getAdapter(provider);

    // For Yahoo, inject a valid OAuth access token (auto-refreshes if expired)
    let effectiveCredentials = credentials;
    if (provider === "YAHOO") {
      const user = (req as any).dbUser;
      try {
        const accessToken = await getValidYahooToken(user.id);
        if (!accessToken) {
          res.status(400).json({ error: "Yahoo account not connected. Please connect Yahoo first." });
          return;
        }
        effectiveCredentials = { ...credentials, accessToken };
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }
    }

    const leagues = await adapter.getLeagues(effectiveCredentials);
    res.json(leagues);
  } catch (err: any) {
    const statusCode = err.statusCode ?? 502;
    const message =
      statusCode === 404
        ? err.message
        : statusCode === 400
          ? err.message
          : `Failed to fetch leagues from ${provider}. Please try again later.`;
    res.status(statusCode).json({ error: message });
  }
});

/** POST /api/leagues/connect — connect and start importing a league */
router.post("/connect", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const { provider, providerLeagueId, name, scoringType, teamCount, credentials, years, seasonLeagueIds } =
    req.body;

  // For Yahoo, inject a valid OAuth access token (auto-refreshes if expired)
  let effectiveCredentials = credentials ?? {};
  if (provider === "YAHOO") {
    try {
      const accessToken = await getValidYahooToken(user.id);
      if (accessToken) {
        effectiveCredentials = { ...effectiveCredentials, accessToken };
      }
    } catch (err: any) {
      console.error("Yahoo token refresh failed during connect:", err.message);
    }
  }

  // Create league
  const league = await prisma.league.upsert({
    where: {
      provider_providerLeagueId: { provider, providerLeagueId },
    },
    create: { name, provider, providerLeagueId, scoringType, teamCount, metadata: seasonLeagueIds ? { seasonLeagueIds } : undefined },
    update: { name, scoringType, teamCount, metadata: seasonLeagueIds ? { seasonLeagueIds } : undefined },
  });

  // Add user as owner
  await prisma.leagueMember.upsert({
    where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
    create: { userId: user.id, leagueId: league.id, role: "OWNER" },
    update: {},
  });

  // Create sync job
  const syncJob = await prisma.syncJob.create({
    data: { leagueId: league.id, jobType: "full_import" },
  });

  // Queue the sync
  await syncQueue.add("sync" as any, {
    syncJobId: syncJob.id,
    leagueId: league.id,
    provider,
    providerLeagueId,
    credentials: effectiveCredentials,
    years: years ?? [],
    seasonLeagueIds: seasonLeagueIds ?? undefined,
  });

  res.status(201).json({
    league: { id: league.id, name: league.name, provider: league.provider },
    syncJobId: syncJob.id,
  });
});

/** GET /api/leagues/invite/:inviteCode — preview an invite (no auth required) */
router.get("/invite/:inviteCode", async (req, res) => {
  const { inviteCode } = req.params as Record<string, string>;

  const league = await prisma.league.findUnique({
    where: { inviteCode },
    include: {
      _count: { select: { members: true } },
    },
  });

  if (!league) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  const isExpired = league.inviteCodeExpiresAt
    ? league.inviteCodeExpiresAt < new Date()
    : true;

  res.json({
    leagueName: league.name,
    provider: league.provider,
    memberCount: league._count.members,
    isValid: !isExpired,
  });
});

/** POST /api/leagues/join/:inviteCode — accept an invite and join the league */
router.post("/join/:inviteCode", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const { inviteCode } = req.params as Record<string, string>;

  const league = await prisma.league.findUnique({
    where: { inviteCode },
  });

  if (!league) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  const isExpired = league.inviteCodeExpiresAt
    ? league.inviteCodeExpiresAt < new Date()
    : true;

  if (isExpired) {
    res.status(410).json({ error: "Invite has expired" });
    return;
  }

  // Check if already a member
  const existing = await prisma.leagueMember.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
  });

  if (existing) {
    res.json({
      id: league.id,
      name: league.name,
      provider: league.provider,
      alreadyMember: true,
    });
    return;
  }

  await prisma.leagueMember.create({
    data: { userId: user.id, leagueId: league.id, role: "MEMBER" },
  });

  res.status(201).json({
    id: league.id,
    name: league.name,
    provider: league.provider,
    alreadyMember: false,
  });
});

/** GET /api/leagues/:leagueId — league detail */
router.get("/:leagueId", requireAuth, requireLeagueMember, async (req, res) => {
  const league = await prisma.league.findUnique({
    where: { id: req.params.leagueId as string },
    include: {
      seasons: { orderBy: { year: "desc" } },
      managers: true,
      members: { include: { user: { select: { name: true, avatarUrl: true } } } },
    },
  });

  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }
  res.json(league);
});

/** POST /api/leagues/:leagueId/sync — trigger a sync for an existing league */
router.post("/:leagueId/sync", requireAuth, requireLeagueMember, async (req, res) => {
  const leagueId = req.params.leagueId as string as string;
  const mode: "full" | "incremental" = req.body?.mode === "incremental" ? "incremental" : "full";

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { seasons: { select: { year: true } } },
  });

  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  // Check for an already-running sync
  const runningSync = await prisma.syncJob.findFirst({
    where: { leagueId, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (runningSync) {
    res.status(409).json({ error: "A sync is already in progress", syncJobId: runningSync.id });
    return;
  }

  // Retrieve credentials, auto-refreshing Yahoo tokens if expired
  const user = (req as any).dbUser;
  const credentials: Record<string, string> = {};

  if (league.provider === "YAHOO") {
    try {
      const accessToken = await getValidYahooToken(user.id);
      if (accessToken) credentials.accessToken = accessToken;
    } catch (err: any) {
      console.error("Yahoo token refresh failed during sync:", err.message);
    }
  } else {
    const providerAccount = await prisma.providerAccount.findFirst({
      where: { userId: user.id, provider: league.provider },
    });
    if (providerAccount?.accessToken) {
      credentials.accessToken = providerAccount.accessToken;
    }
  }

  // Merge any extra credentials from the request body
  if (req.body?.credentials) {
    Object.assign(credentials, req.body.credentials);
  }

  // Merge seasons from DB with any additional seasons from metadata (e.g. newly discovered via previous_league_id)
  const metadataYears = Object.keys((league.metadata as any)?.seasonLeagueIds ?? {}).map(Number);
  const dbYears = league.seasons.map((s: { year: number }) => s.year);
  const years = [...new Set([...dbYears, ...metadataYears])].sort((a, b) => a - b);

  const syncJob = await prisma.syncJob.create({
    data: {
      leagueId,
      jobType: mode === "incremental" ? "incremental_sync" : "full_import",
    },
  });

  await syncQueue.add("sync" as any, {
    syncJobId: syncJob.id,
    leagueId,
    provider: league.provider,
    providerLeagueId: league.providerLeagueId,
    credentials,
    years,
    mode,
    seasonLeagueIds: (league.metadata as any)?.seasonLeagueIds ?? undefined,
  });

  res.status(201).json({ syncJobId: syncJob.id, mode });
});

/** GET /api/leagues/:leagueId/sync-status — check import progress */
router.get("/:leagueId/sync-status", requireAuth, async (req, res) => {
  const jobs = await prisma.syncJob.findMany({
    where: { leagueId: req.params.leagueId as string },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  res.json(jobs[0] ?? null);
});

/** POST /api/leagues/:leagueId/invite — generate an invite link */
router.post("/:leagueId/invite", requireAuth, requireLeagueMember, async (req, res) => {
  const leagueId = req.params.leagueId as string;
  const inviteCode = randomUUID();
  const inviteCodeExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.league.update({
    where: { id: leagueId },
    data: { inviteCode, inviteCodeExpiresAt },
  });

  const inviteUrl = `fantasyhub://invite/${inviteCode}`;
  res.json({ inviteCode, inviteUrl });
});

/** PUT /api/leagues/:leagueId/managers/:managerId/claim — claim a manager as the authenticated user */
router.put("/:leagueId/managers/:managerId/claim", requireAuth, requireLeagueMember, async (req, res) => {
  const user = (req as any).dbUser;
  const { leagueId, managerId } = req.params as Record<string, string>;

  // Verify manager exists in this league
  const manager = await prisma.manager.findFirst({
    where: { id: managerId, leagueId },
  });
  if (!manager) {
    res.status(404).json({ error: "Manager not found in this league" });
    return;
  }

  // Unclaim any previous manager this user had in this league
  await prisma.manager.updateMany({
    where: { leagueId, userId: user.id },
    data: { userId: null },
  });

  // Claim this manager
  const updated = await prisma.manager.update({
    where: { id: managerId },
    data: { userId: user.id },
    select: { id: true, name: true, avatarUrl: true, userId: true },
  });

  res.json(updated);
});

/** GET /api/leagues/:leagueId/my-manager — get the current user's claimed manager */
router.get("/:leagueId/my-manager", requireAuth, requireLeagueMember, async (req, res) => {
  const user = (req as any).dbUser;
  const { leagueId } = req.params as Record<string, string>;

  const manager = await prisma.manager.findFirst({
    where: { leagueId, userId: user.id },
    select: { id: true, name: true, avatarUrl: true },
  });

  res.json(manager);
});

export default router;
