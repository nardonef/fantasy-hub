import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { generateCards, buildRosterNews } from "../src/intelligence/card-generator";
import { getRosterPlayerIds } from "../src/lib/roster";

async function main(): Promise<void> {
  // Find the first league + user combo to test with
  const membership = await prisma.leagueMember.findFirst({
    include: { league: true, user: true },
  });

  if (!membership) {
    console.log("No league memberships found — run sync first");
    await prisma.$disconnect();
    return;
  }

  const { leagueId, userId: dbUserId } = membership;
  console.log(`Testing with league: ${membership.league.name}, user: ${membership.user.email}\n`);

  // Check roster
  const rosterIds = await getRosterPlayerIds(leagueId, dbUserId);
  console.log(`Roster IDs: ${rosterIds ? `${rosterIds.size} players` : "null (no roster synced)"}`);

  // Generate cards
  console.log("\n=== generateCards ===");
  try {
    const cards = await generateCards(leagueId, dbUserId, prisma, { weekOpponent: true });
    console.log(`Action items: ${cards.length}`);
    for (const c of cards) {
      console.log(`  [${c.type}] ${c.headline} (confidence: ${c.confidence})`);
      console.log(`    generatedAt: ${c.generatedAt}`);
    }
  } catch (err) {
    console.error("generateCards threw:", err);
  }

  // Build roster news
  console.log("\n=== buildRosterNews ===");
  try {
    const news = await buildRosterNews(leagueId, dbUserId, prisma, {});
    console.log(`Roster news signals: ${news.length}`);
    if (news[0]) {
      console.log(`  Sample publishedAt: ${news[0].publishedAt}`);
      console.log(`  Sample fetchedAt: ${news[0].fetchedAt}`);
      console.log(`  Full shape: ${JSON.stringify(Object.keys(news[0]))}`);
    }
  } catch (err) {
    console.error("buildRosterNews threw:", err);
  }

  // Simulate the full intelligence response
  console.log("\n=== Full intelligence response shape ===");
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rawSignals = await prisma.signal.findMany({
    where: { fetchedAt: { gte: sevenDaysAgo } },
    include: {
      player: { select: { id: true, fullName: true, position: true, nflTeam: true } },
    },
    orderBy: { fetchedAt: "desc" },
    take: 3,
  });

  console.log(`leagueSignals sample (${rawSignals.length}):`);
  if (rawSignals[0]) {
    const s = rawSignals[0];
    console.log(`  publishedAt type: ${typeof s.publishedAt} value: ${s.publishedAt.toISOString()}`);
    console.log(`  fetchedAt type: ${typeof s.fetchedAt} value: ${s.fetchedAt.toISOString()}`);
    console.log(`  source: ${s.source}`);
  }

  const response = {
    actionItems: [],
    rosterNews: [],
    leagueSignals: rawSignals.map((s) => ({
      id: s.id,
      playerId: s.playerId,
      source: s.source,
      signalType: s.signalType,
      content: s.content,
      publishedAt: s.publishedAt,
      fetchedAt: s.fetchedAt,
      player: s.player,
    })),
    nextCursor: null,
    generatedAt: new Date().toISOString(),
  };

  console.log(`\ngeneratedAt: ${response.generatedAt}`);
  console.log(`JSON size: ${JSON.stringify(response).length} bytes`);
  console.log("No errors — response would serialize cleanly.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
