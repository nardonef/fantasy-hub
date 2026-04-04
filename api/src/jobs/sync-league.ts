import { Queue, Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { getAdapter } from "../providers";

export interface SyncLeaguePayload {
  syncJobId: string;
  leagueId: string;
  provider: string;
  providerLeagueId: string;
  credentials: Record<string, string>;
  years: number[];
  mode?: "full" | "incremental";
  /** Yahoo-specific: maps year → league_key since each season has a different key */
  seasonLeagueIds?: Record<number, string>;
}

export const syncQueue = new Queue<SyncLeaguePayload>("sync-league", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export function startSyncWorker() {
  const worker = new Worker<SyncLeaguePayload>(
    "sync-league",
    async (job: Job<SyncLeaguePayload>) => {
      const { syncJobId, leagueId, provider, providerLeagueId, credentials, years, seasonLeagueIds } = job.data;
      const requestedMode = job.data.mode ?? "full";

      // Determine effective sync mode — fall back to full if no prior sync exists
      let effectiveMode: "full" | "incremental" = requestedMode;
      let _lastSyncCompletedAt: Date | null = null;

      if (requestedMode === "incremental") {
        const lastSync = await prisma.syncJob.findFirst({
          where: { leagueId, status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
        });
        if (lastSync?.completedAt) {
          _lastSyncCompletedAt = lastSync.completedAt;
        } else {
          // No prior successful sync — fall back to full
          effectiveMode = "full";
        }
      }

      // For incremental mode, determine which years to sync
      // Current NFL season year: if before September, it's the previous year's season
      const now = new Date();
      const currentSeasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

      // Filter years: in incremental mode, only sync the current season
      const yearsToSync = effectiveMode === "incremental"
        ? years.filter((y) => y >= currentSeasonYear)
        : years;

      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          totalItems: yearsToSync.length,
          jobType: effectiveMode === "incremental" ? "incremental_sync" : "full_import",
        },
      });

      const adapter = getAdapter(provider);
      let progress = 0;

      // Full sync: wipe all existing data since identity keys are changing
      if (effectiveMode === "full") {
        await prisma.transaction.deleteMany({ where: { season: { leagueId } } });
        await prisma.draftPick.deleteMany({ where: { season: { leagueId } } });
        await prisma.matchup.deleteMany({ where: { season: { leagueId } } });
        await prisma.standing.deleteMany({ where: { season: { leagueId } } });
        await prisma.seasonManager.deleteMany({ where: { season: { leagueId } } });
        await prisma.manager.deleteMany({ where: { leagueId } });
        await prisma.season.deleteMany({ where: { leagueId } });
      }

      for (const year of yearsToSync) {
        try {
          // For Yahoo, use the season-specific league key if available
          const leagueIdForYear = seasonLeagueIds?.[year] ?? providerLeagueId;
          const seasonData = await adapter.getSeasonData(
            credentials,
            leagueIdForYear,
            year
          );

          // Create season
          const season = await prisma.season.upsert({
            where: { leagueId_year: { leagueId, year } },
            create: { leagueId, year, status: "IMPORTING" },
            update: { status: "IMPORTING" },
          });

          // Upsert managers
          for (const m of seasonData.managers) {
            const manager = await prisma.manager.upsert({
              where: {
                leagueId_providerManagerId: {
                  leagueId,
                  providerManagerId: m.providerManagerId,
                },
              },
              create: {
                leagueId,
                providerManagerId: m.providerManagerId,
                name: m.name,
                avatarUrl: m.avatarUrl,
              },
              update: { name: m.name, avatarUrl: m.avatarUrl },
            });

            // Create season-manager entry
            await prisma.seasonManager.upsert({
              where: {
                seasonId_managerId: {
                  seasonId: season.id,
                  managerId: manager.id,
                },
              },
              create: {
                seasonId: season.id,
                managerId: manager.id,
                teamName: m.teamName,
              },
              update: { teamName: m.teamName },
            });
          }

          // Get manager ID map for this league
          const managers = await prisma.manager.findMany({
            where: { leagueId },
          });
          const managerMap = new Map(
            managers.map((m) => [m.providerManagerId, m.id])
          );

          // Import matchups
          for (const matchup of seasonData.matchups) {
            const homeId = managerMap.get(matchup.homeManagerId);
            const awayId = managerMap.get(matchup.awayManagerId);
            if (!homeId || !awayId) continue;

            await prisma.matchup.upsert({
              where: {
                seasonId_week_homeManagerId_awayManagerId: {
                  seasonId: season.id,
                  week: matchup.week,
                  homeManagerId: homeId,
                  awayManagerId: awayId,
                },
              },
              create: {
                seasonId: season.id,
                week: matchup.week,
                matchupType: matchup.matchupType,
                homeManagerId: homeId,
                awayManagerId: awayId,
                homeScore: matchup.homeScore,
                awayScore: matchup.awayScore,
              },
              update: {
                homeScore: matchup.homeScore,
                awayScore: matchup.awayScore,
              },
            });
          }

          // Import draft picks
          for (const pick of seasonData.draftPicks) {
            const managerId = managerMap.get(pick.managerProviderManagerId);
            if (!managerId) continue;

            await prisma.draftPick.upsert({
              where: {
                seasonId_round_pickNumber: {
                  seasonId: season.id,
                  round: pick.round,
                  pickNumber: pick.pickNumber,
                },
              },
              create: {
                seasonId: season.id,
                managerId,
                round: pick.round,
                pickNumber: pick.pickNumber,
                playerName: pick.playerName,
                position: pick.position,
              },
              update: { playerName: pick.playerName, position: pick.position },
            });
          }

          // Import transactions
          await prisma.transaction.deleteMany({ where: { seasonId: season.id } });
          for (const txn of seasonData.transactions) {
            const managerId = managerMap.get(txn.managerProviderManagerId);
            if (!managerId) continue;
            await prisma.transaction.create({
              data: {
                seasonId: season.id,
                managerId,
                type: txn.type,
                playerName: txn.playerName,
                week: txn.week,
                transactionDate: txn.transactionDate,
              },
            });
          }

          // Compute madePlayoffs: managers who appeared in PLAYOFF or CHAMPIONSHIP matchups
          const playoffManagerIds = new Set<string>();
          for (const matchup of seasonData.matchups) {
            if (matchup.matchupType === "PLAYOFF" || matchup.matchupType === "CHAMPIONSHIP") {
              const homeId = managerMap.get(matchup.homeManagerId);
              const awayId = managerMap.get(matchup.awayManagerId);
              if (homeId) playoffManagerIds.add(homeId);
              if (awayId) playoffManagerIds.add(awayId);
            }
          }

          // Update season standings from final data
          for (const s of seasonData.standings) {
            const managerId = managerMap.get(s.managerProviderManagerId);
            if (!managerId) continue;

            await prisma.seasonManager.update({
              where: {
                seasonId_managerId: { seasonId: season.id, managerId },
              },
              data: {
                wins: s.wins,
                losses: s.losses,
                ties: s.ties,
                pointsFor: s.pointsFor,
                pointsAgainst: s.pointsAgainst,
                finalRank: s.rank,
                madePlayoffs: playoffManagerIds.has(managerId),
              },
            });
          }

          await prisma.season.update({
            where: { id: season.id },
            data: {
              status: "IMPORTED",
              championManagerId: seasonData.championManagerId
                ? managerMap.get(seasonData.championManagerId) ?? null
                : null,
            },
          });

          progress++;
          await prisma.syncJob.update({
            where: { id: syncJobId },
            data: { progress },
          });
          await job.updateProgress(Math.round((progress / yearsToSync.length) * 100));
        } catch (err) {
          console.error(`Failed to import season ${year}:`, err);
          await prisma.season.updateMany({
            where: { leagueId, year },
            data: { status: "FAILED" },
          });
        }
      }

      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: { status: "COMPLETED", completedAt: new Date(), syncMode: effectiveMode },
      });
    },
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on("failed", async (job, err) => {
    console.error(`Sync job ${job?.id} failed:`, err.message);
    if (job) {
      await prisma.syncJob.update({
        where: { id: job.data.syncJobId },
        data: { status: "FAILED", error: err.message },
      });
    }
  });

  return worker;
}
