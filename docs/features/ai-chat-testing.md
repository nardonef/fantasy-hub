# AI Chat — Testing, Verification & Eval

> **Status**: Verification scripts in place and passing. LLM eval framework not yet built.
> **Last updated**: 2026-04-02

---

## Overview

AI Chat verification is split into three layers with different goals:

| Layer | What it checks | When to run |
|-------|---------------|-------------|
| **Tool verification** (`verify-tools.ts`) | All 8 tools execute correctly against real DB data | After any change to `src/lib/ai/tools.ts` or the Prisma schema |
| **SSE pipeline** (`verify-sse-tools.ts`) | Full HTTP → OpenAI → stream → DB round trip, one question per tool | After any change to `src/routes/chat.ts`, tool definitions, or system prompt |
| **LLM eval** (not yet built) | Answer quality, factual accuracy, tool routing correctness at scale | Before any production release |

---

## Running the Verification Scripts

Both scripts run directly against the local database via Prisma — no mocking, no stubs.

### Prerequisites

```bash
brew services start postgresql@17   # DB must be running
brew services start redis            # Required for API server
```

### 1. Tool Verification — `verify-tools.ts`

Tests all 8 tool executors directly (no HTTP, no auth, no OpenAI calls). Fast (~2s).

```bash
cd api && node_modules/.bin/tsx src/scripts/verify-tools.ts
```

**What it checks:**
- Pre-flight: league exists in DB, managers loaded, seasons loaded
- Each tool returns a non-empty result with the expected shape
- `get_standings`: returns rows with `managerName`, season filter works, all-seasons works
- `get_manager_stats`: returns stats object with `managerId`, `wins`, `gamesPlayed`
- `get_matchup_history`: returns `managerA`, `managerB`, `winsA`, `winsB`
- `get_draft_results`: returns an array of picks
- `get_weekly_scores`: returns matchups for full season and single week
- `get_league_records`: returns `highestScores`, `champions`, `allTimeWinLeaders`
- `get_playoff_results`: returns `managers` array with playoff PPG data
- `get_transaction_history`: validates response shape (0 rows is acceptable — transactions not synced for test leagues)
- System prompt: renders under 400 tokens, contains league name and manager names

**Expected output on success:**
```
10 passed  /  0 failed  (10 checks)
```

**Fixture IDs** (hardcoded in the script):
- League: BIG12 (`cmmtkch490000pws19wyjaio1`)
- Season: 2024
- Managers resolved at runtime from DB (`firstManager`, `secondManager`)

---

### 2. SSE Coverage Sweep — `verify-sse-tools.ts`

Sends one targeted natural-language question per tool through the full HTTP pipeline and confirms:
1. The expected tool fires (received as a `tool_call` SSE event)
2. A `done` event is received with a `messageId`
3. A `ChatMessage` row with `role = "tool"` and the expected `toolName` exists in the DB

Requires the API server running in **dev bypass mode** (no real Clerk auth needed).

#### Setup

```bash
# Terminal 1 — start API in dev mode
cd api
# Temporarily enable dev bypass:
CLERK_SECRET_KEY=PLACEHOLDER_FOR_TESTING npm run dev

# Terminal 2 — run the sweep
cd api && node_modules/.bin/tsx src/scripts/verify-sse-tools.ts
```

> **Why the placeholder?** `requireAuth` middleware checks `process.env.CLERK_SECRET_KEY?.includes("PLACEHOLDER")` to enable a dev bypass that auto-creates/uses a `dev_user` without a real JWT. The dev user already has league membership seeded in the local DB.

#### What it checks

One targeted question per tool, designed to strongly route to that tool:

| Tool | Question |
|------|----------|
| `get_standings` | "What were the final standings in the 2024 season?" |
| `get_manager_stats` | "What were franknardone's scoring stats in 2024?" |
| `get_matchup_history` | "What is the all-time head-to-head record between franknardone and RyanCurran?" |
| `get_draft_results` | "Who did each manager draft in round 1 of the 2024 draft?" |
| `get_weekly_scores` | "What were all the scores in week 3 of 2024?" |
| `get_league_records` | "What is the highest individual score ever posted in this league?" |
| `get_playoff_results` | "Who performed best in the playoffs compared to their regular season scoring?" |
| `get_transaction_history` | "What trades and waiver moves were made during the 2024 season?" |

Each question is sent as a real OpenAI request. The script creates a dedicated thread, sends all 8 questions sequentially, then deletes the thread on completion.

**Expected output on success:**
```
8 passed  /  0 failed  (8 tools)
```

**Cost:** ~8 OpenAI API calls (~$0.01–0.05 depending on tool response sizes).

---

## Dev Mode Details

The dev bypass in `src/middleware/auth.ts`:

```typescript
const DEV_MODE = process.env.NODE_ENV === "development"
  && process.env.CLERK_SECRET_KEY?.includes("PLACEHOLDER");
```

When active:
- `requireAuth` skips Clerk JWT verification and auto-creates/uses a `dev_user` (clerkId: `"dev_user"`)
- `requireLeagueMember` still enforces membership — the `dev_user` must have a `LeagueMember` row for the target league

The `dev_user` membership for BIG12 and Blake's Shoes is already seeded in the local DB. To add it for a new league:

```sql
INSERT INTO league_members (id, user_id, league_id, role, joined_at)
SELECT gen_random_uuid()::text, u.id, '<league_id>', 'MEMBER', NOW()
FROM users u WHERE u.clerk_id = 'dev_user'
ON CONFLICT (user_id, league_id) DO NOTHING;
```

---

## What Is Not Yet Tested

### LLM Eval (not built)

The verification scripts confirm that tools execute and that GPT-4o routes a single well-phrased question to the right tool. They do not evaluate:

- **Answer quality** — is the response factually correct, well-written, and appropriately concise?
- **Routing reliability** — does the model route ambiguous questions correctly? (e.g., "How did my team do?" — does it call `get_manager_stats` or `get_standings`?)
- **Multi-tool turns** — questions requiring 2+ tools in one response (e.g., "Compare franknardone's playoff performance to the league average")
- **Edge cases** — empty data (no transactions), manager not found, ambiguous manager name references
- **Regression** — does a prompt change degrade answers for previously-passing questions?

A proper LLM eval would use a golden dataset: a set of (question, expected_tool_sequence, expected_answer_shape) tuples run against the live API and scored. This is not yet built.

### iOS End-to-End

The iOS Chat UI has been built and compiled successfully, but has not been exercised end-to-end with real Clerk auth on the simulator. This requires:

```bash
# From the repo root:
/build   # or run the build skill manually
```

Specifically unverified on iOS:
- `ChatTabView` → `ThreadListView` → `NewThreadSheet` → thread creation
- `ChatThreadView` SSE streaming rendering (typing indicator → token-by-token bubble → final message)
- Tool call indicator (`"Looking up get_standings…"` banner) appearing mid-stream
- Stop button cancelling an in-flight stream
- History load on thread re-open

---

## Known Data Gaps

| Gap | Impact |
|-----|--------|
| No transactions in BIG12 DB | `get_transaction_history` always returns 0 rows for BIG12. Tool shape is verified but not data content. Use Blake's Shoes league for transaction coverage if needed. |
| No `ChatEmbedding` rows | RAG retrieval in `rag.ts` always returns `""` (graceful degradation path). RAG is not exercised by any current test. |

---

## Open Eval Questions (from spec)

These are unresolved questions from `docs/features/ai-chat-spec.md §7` that a future eval pass should address:

1. **Tool execution during streaming** — the server buffers partial tool call JSON across chunks. Is the accumulator logic correct for all OpenAI streaming edge cases?
2. **Multi-tool calls in one turn** — GPT-4o can emit multiple tool calls in one response. The agentic loop handles this, but it hasn't been tested with a question that reliably triggers 2+ tools simultaneously.
3. **Context budget** — no token-counting guard exists. A thread with 20 message turns + large tool responses could approach GPT-4o's context limit. No failure mode test exists for this.
4. **Rate limiting** — no per-user rate limiting. Not a concern for local dev but required before any production release.
