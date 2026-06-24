import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  const all = await prisma.signal.findMany({
    where: { source: "FANTASYPROS", signalType: "RANKING_CHANGE" },
    select: { id: true, metadata: true },
  });

  const toDelete = all.filter((s) => {
    const meta = s.metadata as Record<string, unknown> | null;
    const delta = meta?.rankDelta;
    return delta === null || delta === undefined || Math.abs(delta as number) < 10;
  });

  console.log(`Total FANTASYPROS RANKING_CHANGE: ${all.length}`);
  console.log(`To delete (null or |delta| < 10): ${toDelete.length}`);
  console.log(`To keep (|delta| >= 10): ${all.length - toDelete.length}`);

  if (toDelete.length > 0) {
    const { count } = await prisma.signal.deleteMany({
      where: { id: { in: toDelete.map((s) => s.id) } },
    });
    console.log(`Deleted ${count} signals.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
