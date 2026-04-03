/**
 * verify-tools.ts
 *
 * Functional verification script for all 8 AI chat tools.
 * Runs against the live local DB — no API server or auth required.
 *
 * Usage:
 *   cd api && node_modules/.bin/tsx src/scripts/verify-tools.ts
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { executeTool } from "../lib/ai/tools";
import { buildSystemPrompt } from "../lib/ai/prompt";

// ─── Test Fixtures (real data from DB) ─────────────────────────────────────

const LEAGUES = {
  BIG12: "cmmtkch490000pws19wyjaio1",
  BLAKES_SHOES: "cmmv768x20000dks1htaa7gxy",
};

const PRIMARY_LEAGUE = LEAGUES.BIG12;
const PRIMARY_SEASON = 2024;

// ─── Helpers ────────────────────────────────────────────────────────────────

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

function pass(label: string, detail?: string) {
  console.log(`  ${GREEN}✅ PASS${RESET}  ${label}${detail ? ` — ${CYAN}${detail}${RESET}` : ""}`);
}

function fail(label: string, error: string) {
  console.log(`  ${RED}❌ FAIL${RESET}  ${label} — ${RED}${error}${RESET}`);
}

function warn(label: string, detail: string) {
  console.log(`  ${YELLOW}⚠️  WARN${RESET}  ${label} — ${YELLOW}${detail}${RESET}`);
}

function section(title: string) {
  console.log(`\n${BOLD}${CYAN}─── ${title} ───${RESET}`);
}

function summarize(result: unknown): string {
  if (result === null || result === undefined) return "null";
  if (Array.isArray(result)) return `Array(${result.length})`;
  if (typeof result === "object") {
    const keys = Object.keys(result as object);
    return `{${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""}}`;
  }
  return String(result);
}

async function runTool(
  toolName: string,
  args: Record<string, unknown>,
  label: string,
  validate?: (result: unknown) => { ok: boolean; detail: string }
) {
  try {
    const result = await executeTool(toolName, args, PRIMARY_LEAGUE, prisma);
    const isEmpty =
      result === null ||
      result === undefined ||
      (Array.isArray(result) && result.length === 0) ||
      (typeof result === "object" && Object.keys(result as object).length === 0);

    if (isEmpty) {
      warn(label, "returned empty result — check if data exists for these args");
      return { ok: false, result };
    }

    if (validate) {
      const { ok, detail } = validate(result);
      if (!ok) {
        fail(label, detail);
        return { ok: false, result };
      }
      pass(label, detail);
    } else {
      pass(label, summarize(result));
    }
    return { ok: true, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fail(label, message);
    return { ok: false, result: null };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}Fantasy Hub — Tool Verification${RESET}`);
  console.log(`League: BIG12 (${PRIMARY_LEAGUE})`);
  console.log(`Season: ${PRIMARY_SEASON}`);

  const results: { tool: string; ok: boolean }[] = [];

  // ── 0. Pre-flight: confirm league and managers exist ──────────────────────
  section("Pre-flight")

  const league = await prisma.league.findUnique({ where: { id: PRIMARY_LEAGUE } });
  if (!league) {
    console.log(`${RED}FATAL: League not found in DB. Aborting.${RESET}`);
    process.exit(1);
  }
  pass("League exists", `"${league.name}" (${league.provider})`);

  const managers = await prisma.manager.findMany({
    where: { leagueId: PRIMARY_LEAGUE },
  });
  if (managers.length === 0) {
    console.log(`${RED}FATAL: No managers found for league. Aborting.${RESET}`);
    process.exit(1);
  }
  pass("Managers loaded", `${managers.length} managers`);

  const firstManager = managers[0];
  const secondManager = managers[1] ?? managers[0];

  const seasons = await prisma.season.findMany({
    where: { leagueId: PRIMARY_LEAGUE },
    orderBy: { year: "desc" },
  });
  pass("Seasons loaded", seasons.map(s => s.year).join(", "));

  // ── 1. get_standings ──────────────────────────────────────────────────────
  section("Tool 1/8 — get_standings")

  let r = await runTool("get_standings", { season: PRIMARY_SEASON }, "with season filter",
    (res) => {
      const rows = res as any[];
      return {
        ok: rows.length > 0 && rows[0].managerName !== undefined,
        detail: `${rows.length} managers, first: ${rows[0]?.managerName}`,
      };
    }
  );
  results.push({ tool: "get_standings (season)", ok: r.ok });

  r = await runTool("get_standings", {}, "without season filter (all seasons)",
    (res) => {
      const rows = res as any[];
      return { ok: rows.length > 0, detail: `${rows.length} total rows` };
    }
  );
  results.push({ tool: "get_standings (all)", ok: r.ok });

  // ── 2. get_manager_stats ─────────────────────────────────────────────────
  section("Tool 2/8 — get_manager_stats")

  r = await runTool(
    "get_manager_stats",
    { managerId: firstManager.id, season: PRIMARY_SEASON },
    `for "${firstManager.name}" in ${PRIMARY_SEASON}`,
    (res: any) => ({
      ok: res.managerId !== undefined || res.manager !== undefined || (res.wins !== undefined),
      detail: summarize(res),
    })
  );
  results.push({ tool: "get_manager_stats", ok: r.ok });

  // ── 3. get_matchup_history ───────────────────────────────────────────────
  section("Tool 3/8 — get_matchup_history")

  r = await runTool(
    "get_matchup_history",
    { managerIdA: firstManager.id, managerIdB: secondManager.id },
    `"${firstManager.name}" vs "${secondManager.name}"`,
    (res: any) => ({
      ok: res.managerA !== undefined || (typeof res === "object" && Object.keys(res).length > 0),
      detail: summarize(res),
    })
  );
  results.push({ tool: "get_matchup_history", ok: r.ok });

  // ── 4. get_draft_results ─────────────────────────────────────────────────
  section("Tool 4/8 — get_draft_results")

  r = await runTool(
    "get_draft_results",
    { season: PRIMARY_SEASON },
    `draft for ${PRIMARY_SEASON}`,
    (res: any) => {
      const picks = Array.isArray(res) ? res : res.picks ?? [];
      return { ok: picks.length > 0, detail: `${picks.length} picks` };
    }
  );
  results.push({ tool: "get_draft_results", ok: r.ok });

  // ── 5. get_weekly_scores ─────────────────────────────────────────────────
  section("Tool 5/8 — get_weekly_scores")

  r = await runTool(
    "get_weekly_scores",
    { season: PRIMARY_SEASON },
    `all weeks in ${PRIMARY_SEASON}`,
    (res: any) => {
      const rows = Array.isArray(res) ? res : res.matchups ?? res.scores ?? [];
      return { ok: rows.length > 0, detail: `${rows.length} matchups` };
    }
  );
  results.push({ tool: "get_weekly_scores", ok: r.ok });

  r = await runTool(
    "get_weekly_scores",
    { season: PRIMARY_SEASON, week: 1 },
    `week 1 of ${PRIMARY_SEASON}`,
    (res: any) => {
      const rows = Array.isArray(res) ? res : res.matchups ?? res.scores ?? [];
      return { ok: rows.length > 0, detail: `${rows.length} matchups` };
    }
  );
  results.push({ tool: "get_weekly_scores (single week)", ok: r.ok });

  // ── 6. get_league_records ────────────────────────────────────────────────
  section("Tool 6/8 — get_league_records")

  r = await runTool(
    "get_league_records",
    {},
    "all-time records",
    (res: any) => ({
      ok: typeof res === "object" && Object.keys(res).length > 0,
      detail: `keys: ${Object.keys(res as object).slice(0, 4).join(", ")}`,
    })
  );
  results.push({ tool: "get_league_records", ok: r.ok });

  // ── 7. get_playoff_results ───────────────────────────────────────────────
  section("Tool 7/8 — get_playoff_results")

  r = await runTool(
    "get_playoff_results",
    { season: PRIMARY_SEASON },
    `playoffs ${PRIMARY_SEASON}`,
    (res: any) => {
      const rows = Array.isArray(res) ? res : res.managers ?? res.results ?? res.matchups ?? [];
      return { ok: rows.length > 0, detail: `${rows.length} managers with playoff data` };
    }
  );
  results.push({ tool: "get_playoff_results", ok: r.ok });

  // ── 8. get_transaction_history ───────────────────────────────────────────
  section("Tool 8/8 — get_transaction_history")

  // Transactions: Sleeper sync does not currently import transactions, so 0 rows is expected
  // for most test leagues. We verify the tool executes without error (returns a valid shape)
  // rather than asserting non-empty data.
  r = await runTool(
    "get_transaction_history",
    { season: PRIMARY_SEASON },
    `transactions in ${PRIMARY_SEASON} (0 rows expected — transactions not synced)`,
    (res: any) => {
      // Valid if the tool returns the expected shape, even if empty
      const hasShape = typeof res === "object" && "transactions" in res && Array.isArray(res.transactions);
      return {
        ok: hasShape,
        detail: hasShape ? `shape ok, ${res.transactions.length} transactions in DB` : "unexpected response shape",
      };
    }
  );
  results.push({ tool: "get_transaction_history", ok: r.ok });

  // ── 9. System prompt smoke test ──────────────────────────────────────────
  section("System Prompt")

  try {
    const prompt = buildSystemPrompt({
      leagueName: league.name,
      platform: league.provider.toLowerCase(),
      scoringType: league.scoringType ?? "Standard",
      seasons: `${seasons[seasons.length - 1]?.year}–${seasons[0]?.year}`,
      managers: managers.map(m => ({
        name: m.name,
        teamName: m.name,
        isCurrentUser: false,
      })),
      currentUserTeamName: managers[0]?.name ?? "Unknown",
      currentUserName: managers[0]?.name ?? "Unknown",
    });

    const tokenEstimate = Math.round(prompt.length / 4);
    if (tokenEstimate > 400) {
      warn("Prompt token estimate", `~${tokenEstimate} tokens — target is <300`);
    } else {
      pass("Prompt renders", `~${tokenEstimate} tokens`);
    }

    const hasLeagueName = prompt.includes(league.name);
    const hasManagerNames = managers.slice(0, 3).every(m => prompt.includes(m.name));
    if (!hasLeagueName) fail("League name in prompt", "not found");
    else pass("League name in prompt", `"${league.name}"`);
    if (!hasManagerNames) warn("Manager names in prompt", "some missing — check buildSystemPrompt");
    else pass("Manager names in prompt", "first 3 found");
  } catch (err: unknown) {
    fail("buildSystemPrompt threw", err instanceof Error ? err.message : String(err));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  section("Summary")

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log(`\n  ${GREEN}${passed} passed${RESET}  /  ${failed > 0 ? RED : GREEN}${failed} failed${RESET}  (${results.length} checks)\n`);

  if (failed > 0) {
    console.log(`${RED}Failed tools:${RESET}`);
    results.filter(r => !r.ok).forEach(r => console.log(`  • ${r.tool}`));
    console.log();
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(RED + "Unhandled error:" + RESET, err);
  prisma.$disconnect();
  process.exit(1);
});
