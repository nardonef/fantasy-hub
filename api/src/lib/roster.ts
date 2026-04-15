/**
 * roster.ts
 *
 * Provides access to the current-season roster for a user in a given league.
 * Roster data is stored in the `roster_players` table and populated during
 * league sync (sync-league job). This module reads from the DB — no live
 * provider API calls at request time.
 *
 * Returns null when no roster has been synced yet (e.g. right after onboarding
 * before the first sync completes). Callers interpret null as "show all players".
 */

import { prisma } from "./prisma";

/**
 * Returns the set of internal player IDs on the user's current-season roster
 * for the given league. Returns null if:
 *   - the user has no manager record in this league, or
 *   - no roster has been synced yet for this league.
 *
 * An empty Set means the roster was synced but contains no resolvable players.
 */
export async function getRosterPlayerIds(
  leagueId: string,
  dbUserId: string
): Promise<Set<string> | null> {
  const manager = await prisma.manager.findFirst({
    where: { leagueId, userId: dbUserId },
    select: { id: true },
  });

  if (!manager) return null;

  const rows = await prisma.rosterPlayer.findMany({
    where: { leagueId, managerId: manager.id },
    select: { playerId: true },
  });

  // No rows means roster hasn't been synced — fall back to showing all players
  if (rows.length === 0) return null;

  // Return only the rows where we successfully resolved a player ID
  return new Set(rows.filter((r) => r.playerId !== null).map((r) => r.playerId!));
}
