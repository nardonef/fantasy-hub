import { Worker, Queue, type Job } from "bullmq";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { resolvePlayer } from "../ingestion/player-resolution";
import { RedditAdapter } from "../ingestion/adapters/reddit";
import { FantasyProsAdapter } from "../ingestion/adapters/fantasypros";
import { SportsdataAdapter } from "../ingestion/adapters/sportsdata";
import type { IngestionAdapter, RawSignal } from "../ingestion/types";
import type { Prisma } from "../generated/prisma/client";

export const ingestionQueue = new Queue("ingest-signals", { connection: redisConnection });

const ADAPTERS: IngestionAdapter[] = [];

function buildAdapters(): void {
  // Reddit public JSON API — no credentials needed
  ADAPTERS.push(new RedditAdapter(prisma));
  // FantasyPros is always available (public page, no credentials needed)
  ADAPTERS.push(new FantasyProsAdapter(prisma));
  if (process.env.SPORTSDATA_API_KEY) {
    ADAPTERS.push(new SportsdataAdapter(process.env.SPORTSDATA_API_KEY, prisma));
  }
  // Future: BlueskyAdapter
}

export function startIngestionWorker(): void {
  buildAdapters();

  const worker = new Worker(
    "ingest-signals",
    async (job: Job) => {
      const source = job.data.source as string | undefined;
      const adapters = source
        ? ADAPTERS.filter((a) => a.source === source)
        : ADAPTERS;

      let totalPersisted = 0;

      for (const adapter of adapters) {
        const jobRecord = await prisma.ingestionJob.upsert({
          where: { id: `${adapter.source}-singleton` },
          create: {
            id: `${adapter.source}-singleton`,
            source: adapter.source,
            status: "RUNNING",
          },
          update: { status: "RUNNING", lastRunAt: new Date(), error: null },
        });

        try {
          const rawSignals = await adapter.fetchSignals();
          const persisted = await persistSignals(rawSignals);
          totalPersisted += persisted;

          await prisma.ingestionJob.update({
            where: { id: jobRecord.id },
            data: {
              status: "COMPLETED",
              recordsFetched: persisted,
              lastRunAt: new Date(),
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await prisma.ingestionJob.update({
            where: { id: jobRecord.id },
            data: { status: "FAILED", error: message },
          });
          console.error(`[ingest-signals] ${adapter.source} failed:`, message);
        }
      }

      return { persisted: totalPersisted };
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[ingest-signals] job ${job?.id} failed:`, err.message);
  });
}

async function persistSignals(rawSignals: RawSignal[]): Promise<number> {
  let count = 0;
  for (const raw of rawSignals) {
    const playerId = await resolvePlayer(raw.rawPlayerName, raw.source, prisma);
    if (!playerId) continue; // Unresolvable — skip

    await prisma.signal.create({
      data: {
        playerId,
        source: raw.source,
        signalType: raw.signalType,
        content: raw.content,
        metadata: (raw.metadata ?? {}) as Prisma.InputJsonValue,
        publishedAt: raw.publishedAt,
      },
    });
    count++;
  }
  return count;
}
