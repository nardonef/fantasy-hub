/**
 * test-twitter-adapter.ts
 *
 * Probes each Nitter instance for reachability, then runs the TwitterAdapter
 * against the first live instance and reports how many signals were resolved.
 *
 * Usage: npx tsx scripts/test-twitter-adapter.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { TwitterAdapter } from "../src/ingestion/adapters/twitter";
import { resolvePlayer } from "../src/ingestion/player-resolution";
import type { Prisma } from "../src/generated/prisma/client";

const NITTER_INSTANCES = [
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.1d4.us",
];

async function probeNitter(): Promise<void> {
  console.log("=== Nitter Instance Probe ===\n");

  for (const base of NITTER_INSTANCES) {
    try {
      const res = await fetch(`${base}/FantasyPros/rss`, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "FantasyHub/1.0" },
      });
      const status = res.ok ? "✓ reachable" : `✗ HTTP ${res.status}`;
      console.log(`  ${base} — ${status}`);
    } catch (err) {
      console.log(`  ${base} — ✗ unreachable (${(err as Error).message})`);
    }
  }

  console.log();
}

async function runAdapter(): Promise<void> {
  console.log("=== Running TwitterAdapter ===\n");

  const adapter = new TwitterAdapter(prisma);

  let rawSignals;
  try {
    rawSignals = await adapter.fetchSignals();
  } catch (err) {
    console.error("Adapter threw unexpectedly:", err);
    return;
  }

  if (rawSignals.length === 0) {
    console.log("No raw signals returned — all Nitter instances likely unreachable or all tweets already seen.");
    return;
  }

  console.log(`Raw signals extracted: ${rawSignals.length}`);

  // Resolve and persist (same logic as ingest-signals worker)
  let persisted = 0;
  let unresolved = 0;
  const unresolvedNames = new Set<string>();

  for (const raw of rawSignals) {
    const playerId = await resolvePlayer(raw.rawPlayerName, raw.source, prisma);
    if (!playerId) {
      unresolved++;
      unresolvedNames.add(raw.rawPlayerName);
      continue;
    }

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
    persisted++;
  }

  console.log(`Resolved + persisted: ${persisted}`);
  console.log(`Unresolved player names: ${unresolved}`);

  if (unresolvedNames.size > 0) {
    const sample = Array.from(unresolvedNames).slice(0, 10);
    console.log(`\nSample unresolved names (up to 10):\n  ${sample.join("\n  ")}`);
  }

  if (persisted > 0) {
    const recent = await prisma.signal.findMany({
      where: { source: "TWITTER" },
      orderBy: { fetchedAt: "desc" },
      take: 5,
      include: { player: { select: { fullName: true, position: true } } },
    });

    console.log("\nMost recent TWITTER signals now in DB:");
    for (const s of recent) {
      console.log(`  [${s.player.position}] ${s.player.fullName} — ${s.content.slice(0, 80)}...`);
    }
  }
}

async function main(): Promise<void> {
  await probeNitter();
  await runAdapter();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
