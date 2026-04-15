import type { PrismaClient } from "../generated/prisma/client";

/**
 * Resolves a raw player name string to a canonical Player.id using a two-step
 * strategy (Decision 015 — Alias Table + Exact-First):
 *
 *   1. Exact lookup in PlayerNameAlias — fast path, O(1) indexed lookup.
 *   2. Levenshtein distance against Player.fullName — catches abbreviations
 *      and minor spelling variants (threshold ≤ 2 edits).
 *
 * On a successful fuzzy match, the new alias is saved so future lookups for
 * the same raw string are instant (the alias table self-builds over time).
 *
 * Returns the Player.id on success, null if unresolvable.
 */
export async function resolvePlayer(
  rawName: string,
  source: string,
  prisma: PrismaClient
): Promise<string | null> {
  const normalized = rawName.trim();

  // ── Step 1: Exact alias lookup ────────────────────────────────────────────
  const alias = await prisma.playerNameAlias.findUnique({
    where: { alias: normalized },
    select: { playerId: true },
  });
  if (alias) return alias.playerId;

  // ── Step 2: Exact match against Player.fullName ───────────────────────────
  const exactPlayer = await prisma.player.findFirst({
    where: { fullName: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });
  if (exactPlayer) {
    await saveAlias(normalized, exactPlayer.id, source, prisma);
    return exactPlayer.id;
  }

  // ── Step 3: Levenshtein fuzzy match (threshold ≤ 2) ──────────────────────
  const allPlayers = await prisma.player.findMany({
    select: { id: true, fullName: true },
  });

  let bestMatch: { id: string; distance: number } | null = null;
  for (const player of allPlayers) {
    const distance = levenshtein(normalized.toLowerCase(), player.fullName.toLowerCase());
    if (distance <= 2) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { id: player.id, distance };
      }
    }
  }

  // Ambiguous if multiple players share the same minimum distance — leave unresolved.
  if (bestMatch) {
    const matchCount = allPlayers.filter(
      (p) => levenshtein(normalized.toLowerCase(), p.fullName.toLowerCase()) === bestMatch!.distance
    ).length;
    if (matchCount === 1) {
      await saveAlias(normalized, bestMatch.id, source, prisma);
      return bestMatch.id;
    }
  }

  return null;
}

async function saveAlias(
  alias: string,
  playerId: string,
  source: string,
  prisma: PrismaClient
): Promise<void> {
  await prisma.playerNameAlias.upsert({
    where: { alias },
    create: { alias, playerId, source },
    update: {},
  });
}

/** Standard iterative Levenshtein distance. O(n*m) — fine for ~2,000 NFL players. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
