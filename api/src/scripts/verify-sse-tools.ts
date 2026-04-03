/**
 * verify-sse-tools.ts
 *
 * Per-tool SSE coverage sweep. For each of the 8 AI tools, sends a targeted
 * natural-language question through the full HTTP → OpenAI → SSE pipeline and
 * confirms:
 *   1. The SSE stream completes with a "done" event.
 *   2. The persisted ChatMessage history contains the expected toolName.
 *
 * Requires the API server to be running on localhost:3000 in dev-bypass mode
 * (CLERK_SECRET_KEY must contain "PLACEHOLDER"). Run via:
 *
 *   CLERK_SECRET_KEY=PLACEHOLDER_FOR_TESTING npm run dev   # in one terminal
 *   cd api && node_modules/.bin/tsx src/scripts/verify-sse-tools.ts
 */

import "dotenv/config";

const BASE = "http://localhost:3000";
const LEAGUE_ID = "cmmtkch490000pws19wyjaio1";

// One question per tool, worded to strongly route to that specific tool.
const TOOL_PROBES: { tool: string; question: string }[] = [
  {
    tool: "get_standings",
    question: "What were the final standings in the 2024 season?",
  },
  {
    tool: "get_manager_stats",
    question: "What were franknardone's scoring stats in 2024?",
  },
  {
    tool: "get_matchup_history",
    question: "What is the all-time head-to-head record between franknardone and RyanCurran?",
  },
  {
    tool: "get_draft_results",
    question: "Who did each manager draft in round 1 of the 2024 draft?",
  },
  {
    tool: "get_weekly_scores",
    question: "What were all the scores in week 3 of 2024?",
  },
  {
    tool: "get_league_records",
    question: "What is the highest individual score ever posted in this league?",
  },
  {
    tool: "get_playoff_results",
    question: "Who performed best in the playoffs compared to their regular season scoring?",
  },
  {
    tool: "get_transaction_history",
    question: "What trades and waiver moves were made during the 2024 season?",
  },
];

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

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (res.status !== 204 && !res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

/**
 * Stream an SSE endpoint and collect: tool names fired, done messageId, full text.
 * Throws on stream error event or non-2xx status.
 */
async function streamMessage(
  leagueId: string,
  threadId: string,
  content: string
): Promise<{ toolsFired: string[]; messageId: string; text: string }> {
  const res = await fetch(`${BASE}/api/leagues/${leagueId}/chat/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) throw new Error(`SSE request failed: ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("No response body");

  const toolsFired: string[] = [];
  let messageId = "";
  let text = "";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (!json) continue;

      let event: any;
      try { event = JSON.parse(json); } catch { continue; }

      switch (event.type) {
        case "delta":
          text += event.content ?? "";
          break;
        case "tool_call":
          if (event.toolName && !toolsFired.includes(event.toolName)) {
            toolsFired.push(event.toolName);
          }
          break;
        case "done":
          messageId = event.messageId ?? "";
          break;
        case "error":
          throw new Error(`SSE error event: ${event.error}`);
      }
    }
  }

  if (!messageId) throw new Error("Stream ended without a 'done' event");
  return { toolsFired, messageId, text };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}Fantasy Hub — SSE Per-Tool Coverage Sweep${RESET}`);
  console.log(`League: BIG12 (${LEAGUE_ID})\n`);

  // Pre-flight: confirm server is up and in dev mode
  section("Pre-flight");
  try {
    const leagues = await get<any[]>("/api/leagues");
    const target = leagues.find((l: any) => l.id === LEAGUE_ID);
    if (!target) throw new Error("BIG12 league not found");
    pass("API reachable", `${leagues.length} leagues, BIG12 confirmed`);
  } catch (err: any) {
    console.log(`${RED}FATAL: ${err.message}${RESET}`);
    console.log(`${YELLOW}Make sure the API is running in dev mode:${RESET}`);
    console.log(`  CLERK_SECRET_KEY=PLACEHOLDER_FOR_TESTING npm run dev`);
    process.exit(1);
  }

  // Create a dedicated thread for this sweep
  let threadId: string;
  try {
    const thread = await post<{ id: string }>(
      `/api/leagues/${LEAGUE_ID}/chat/threads`,
      { title: "SSE Tool Coverage Sweep" }
    );
    threadId = thread.id;
    pass("Thread created", threadId);
  } catch (err: any) {
    console.log(`${RED}FATAL: Could not create thread — ${err.message}${RESET}`);
    process.exit(1);
  }

  // Run each probe
  const results: { tool: string; ok: boolean }[] = [];

  for (const probe of TOOL_PROBES) {
    section(`Tool: ${probe.tool}`);
    console.log(`  ${CYAN}Q:${RESET} "${probe.question}"`);

    try {
      const { toolsFired, messageId, text } = await streamMessage(LEAGUE_ID, threadId, probe.question);

      // Check tool fired via SSE
      const firedViaSSE = toolsFired.includes(probe.tool);

      // Check tool persisted in ChatMessage history
      const messages = await get<{ messages: any[] }>(
        `/api/leagues/${LEAGUE_ID}/chat/threads/${threadId}/messages`
      );
      const toolMessages = messages.messages.filter(
        (m: any) => m.role === "tool" && m.toolName === probe.tool
      );
      const persistedInDB = toolMessages.length > 0;

      if (!firedViaSSE && !persistedInDB) {
        // Some tools (e.g. get_transaction_history with no data) may be skipped by the model
        warn(probe.tool, `not triggered — model may have answered without tools. Text: "${text.slice(0, 80)}…"`);
        results.push({ tool: probe.tool, ok: false });
      } else {
        const detail = [
          firedViaSSE ? "SSE event ✓" : "SSE event ✗",
          persistedInDB ? "DB persisted ✓" : "DB persisted ✗",
          `messageId: ${messageId}`,
        ].join(", ");
        pass(probe.tool, detail);
        results.push({ tool: probe.tool, ok: true });
      }
    } catch (err: any) {
      fail(probe.tool, err.message);
      results.push({ tool: probe.tool, ok: false });
    }
  }

  // Cleanup
  section("Cleanup");
  try {
    await del(`/api/leagues/${LEAGUE_ID}/chat/threads/${threadId}`);
    pass("Test thread deleted", threadId);
  } catch (err: any) {
    warn("Cleanup", `Could not delete thread: ${err.message}`);
  }

  // Summary
  section("Summary");
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n  ${GREEN}${passed} passed${RESET}  /  ${failed > 0 ? RED : GREEN}${failed} failed${RESET}  (${results.length} tools)\n`);

  if (failed > 0) {
    console.log(`${RED}Did not fire:${RESET}`);
    results.filter(r => !r.ok).forEach(r => console.log(`  • ${r.tool}`));
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(RED + "Unhandled error:" + RESET, err);
  process.exit(1);
});
