/**
 * seed-players.ts
 *
 * Populates the Player table from Sleeper's public NFL player endpoint.
 * Safe to re-run — uses upsert on fullName so existing records are updated,
 * not duplicated.
 *
 * Usage: npx tsx scripts/seed-players.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Positions we care about for fantasy signal resolution
const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

interface SleeperPlayer {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  fantasy_positions?: string[];
  team?: string;
  active?: boolean;
  status?: string;
}

async function main(): Promise<void> {
  console.log("Fetching NFL players from Sleeper...");
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status}`);

  const raw = (await res.json()) as Record<string, SleeperPlayer>;
  const players = Object.values(raw);
  console.log(`Fetched ${players.length} total entries`);

  const eligible = players.filter((p) => {
    if (!p.full_name) return false;
    if (!p.active) return false;
    const positions = p.fantasy_positions ?? (p.position ? [p.position] : []);
    return positions.some((pos) => FANTASY_POSITIONS.has(pos));
  });

  console.log(`Upserting ${eligible.length} active fantasy-relevant players...`);

  let upserted = 0;
  for (const p of eligible) {
    const name = p.full_name!;
    const positions = p.fantasy_positions ?? (p.position ? [p.position] : []);
    const position = positions.find((pos) => FANTASY_POSITIONS.has(pos)) ?? null;
    const team = p.team ?? null;

    const sleeperId = p.player_id ?? null;
    await prisma.player.upsert({
      where: { fullName: name },
      create: { fullName: name, position, nflTeam: team, status: "active", metadata: sleeperId ? { sleeperId } : undefined },
      update: { position, nflTeam: team, status: "active", metadata: sleeperId ? { sleeperId } : undefined },
    });
    upserted++;
  }

  console.log(`Done. ${upserted} players upserted.`);

  const total = await prisma.player.count();
  console.log(`Player table now contains ${total} rows.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
