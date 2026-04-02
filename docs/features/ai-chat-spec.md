# AI Chat — V2 Feature Spec

> **Status**: Spec complete, not started
> **Phase**: V2
> **Last updated**: 2026-04-01

---

## 1. Problem Statement

Fantasy League Hub users have years of imported league history — matchup records, scoring trends, draft grades, head-to-head rivalries, standings, and transaction logs. The analytics tab surfaces this data visually, but users can only ask the questions the predefined views answer.

The AI Chat feature adds a natural-language interface scoped to a single league. Users can ask open-ended questions ("Who has the best record against top-3 seeds in the playoffs?", "Has my scoring improved since 2021?", "Who got the worst value out of the 2023 draft?") and receive grounded, data-backed answers. The assistant calls thin wrappers over the existing V1 analytics endpoints as tools, optionally retrieving semantically relevant context via RAG, and streams a response token-by-token.

Chat is organized into persistent, user-named threads per league (ChatGPT-style), so users can maintain separate conversations for different lines of inquiry and return to them across sessions.

---

## 2. Decisions Summary

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 021 | LLM Provider | OpenAI GPT-4o | Best tool-use reliability; strong function-calling support; manageable cost at chat volume |
| 022 | Embedding Strategy | Dedicated Embedding Table (pgvector) | Keeps semantic search in Postgres alongside relational data; avoids a separate vector store |
| 023 | Tool Inventory | Thin wrappers over V1 analytics endpoints | Zero duplication; reuses all existing query logic; tools return pre-aggregated data the LLM can reason over |
| 025 | Conversation History | Persistent DB Threads (`ChatThread` + `ChatMessage` in Prisma) | Threads survive app restarts; enables multi-session continuity and future server-side replay |
| 026 | Streaming | SSE Token Streaming | Express pipes OpenAI stream via `text/event-stream`; iOS renders tokens progressively; eliminates perceived latency |
| 027 | Context Injection | Lean Header (~200 tokens) + Tools (on-demand) + RAG (semantic retrieval) | Header keeps the model grounded without burning context budget; tools fetch data on demand; RAG surfaces relevant history |
| 028 | Threading Model | User-Named Threads per league | One thread per topic; users name threads explicitly; threads are scoped to a single league |

---

## 3. API Shape

All endpoints are under `/api/leagues/:leagueId/chat/...` and require Clerk auth + league membership (same middleware stack as analytics endpoints: `requireAuth`, `requireLeagueMember`).

### 3.1 Create Thread

**`POST /api/leagues/:leagueId/chat/threads`**

Auth: Required (Clerk token). Membership: Required.

Request body:
```json
{
  "title": "2024 draft review"
}
```

Response `201`:
```json
{
  "id": "clxyz...",
  "leagueId": "cl...",
  "userId": "user_...",
  "title": "2024 draft review",
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-01T00:00:00.000Z"
}
```

Validation: `title` is required, max 120 characters. Returns `400` if missing/too long.

---

### 3.2 List Threads

**`GET /api/leagues/:leagueId/chat/threads`**

Auth: Required. Membership: Required.

Returns threads owned by the authenticated user (`userId` = Clerk user ID) within the league, ordered by `updatedAt` descending (most recently active first).

Response `200`:
```json
[
  {
    "id": "clxyz...",
    "title": "2024 draft review",
    "createdAt": "2026-04-01T00:00:00.000Z",
    "updatedAt": "2026-04-01T00:00:00.000Z",
    "_count": { "messages": 14 }
  }
]
```

No pagination in V2; practical thread counts per user per league are small.

---

### 3.3 Delete Thread

**`DELETE /api/leagues/:leagueId/chat/threads/:threadId`**

Auth: Required. Membership: Required.

Deletes the thread and all its messages (cascade handled by Prisma/DB). Returns `403` if the thread's `userId` does not match the authenticated user.

Response `204`: No content.

---

### 3.4 Send Message (SSE Streaming)

**`POST /api/leagues/:leagueId/chat/threads/:threadId/messages`**

Auth: Required. Membership: Required.

Request body:
```json
{
  "content": "Who has the most playoff wins all time?"
}
```

Response: `Content-Type: text/event-stream`. The endpoint:
1. Persists the user message to `ChatMessage` (role: `"user"`).
2. Builds the system prompt (lean header + tool definitions).
3. Loads recent thread history (last N messages, configurable, default 20).
4. Optionally runs a RAG retrieval query against `ChatEmbedding` to inject relevant context.
5. Calls the OpenAI Chat Completions API with streaming enabled.
6. For each tool call, executes the corresponding V1 analytics query and streams a `tool` event.
7. Streams `delta` events for each token chunk as they arrive from OpenAI.
8. On stream completion, persists the full assistant message to `ChatMessage` (role: `"assistant"`).

SSE event format — each line is a self-contained JSON object in the `data:` field. The `type` field distinguishes event kinds (simpler for iOS `AsyncBytes` parsing than named SSE events):
```
data: {"type":"delta","content":"Based on the playoff data"}

data: {"type":"delta","content":", Frank has the most..."}

data: {"type":"tool_call","toolName":"getStandings","status":"running"}

data: {"type":"done","messageId":"clxyz..."}

data: {"type":"error","error":"OpenAI quota exceeded"}
```

The `done` event carries the persisted `ChatMessage` ID so the client can reconcile its local state.

---

### 3.5 Get Message History

**`GET /api/leagues/:leagueId/chat/threads/:threadId/messages`**

Auth: Required. Membership: Required.

Query params:
- `limit` (optional, default 50, max 200) — number of messages to return
- `before` (optional) — cursor: return messages with `createdAt` before this ISO timestamp

Returns messages in ascending chronological order (oldest first) so iOS can render a standard chat timeline.

Response `200`:
```json
{
  "messages": [
    {
      "id": "cl...",
      "threadId": "cl...",
      "role": "user",
      "content": "Who has the most playoff wins all time?",
      "toolName": null,
      "createdAt": "2026-04-01T00:00:00.000Z"
    },
    {
      "id": "cl...",
      "threadId": "cl...",
      "role": "assistant",
      "content": "Based on playoff data across all seasons, Frank has the most...",
      "toolName": null,
      "createdAt": "2026-04-01T00:00:00.000Z"
    }
  ],
  "hasMore": false
}
```

---

## 4. Data Model Changes

Two new Prisma models. One new relation on `League`.

### 4.1 `ChatThread`

```prisma
model ChatThread {
  id        String        @id @default(cuid())
  userId    String        // Clerk user ID (not a FK — Clerk manages user identity)
  leagueId  String        // FK to League
  title     String        // user-named, e.g. "2024 draft review"
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]

  league    League        @relation(fields: [leagueId], references: [id], onDelete: Cascade)

  @@index([userId, leagueId])
}
```

`userId` stores the Clerk user ID string directly (not a FK to `User.id`) because `User.id` is a cuid internal to this app, while Clerk's user ID is available on every authenticated request without a DB lookup. This is consistent with how `requireAuth` works elsewhere.

### 4.2 `ChatMessage`

```prisma
model ChatMessage {
  id        String      @id @default(cuid())
  threadId  String
  role      String      // "user" | "assistant" | "tool"
  content   String      @db.Text
  toolName  String?     // populated when role = "tool"
  createdAt DateTime    @default(now())

  thread    ChatThread  @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
}
```

`role` is a plain `String` rather than an enum to remain forward-compatible with OpenAI's role vocabulary (`"system"`, `"function"`, future values) without requiring a schema migration.

`toolName` captures which V1 tool was called when `role = "tool"`, enabling future UI that can show "Assistant looked up playoff data" inline in the message thread.

### 4.3 `League` relation

Add `chatThreads ChatThread[]` to the existing `League` model's relation list (alongside `seasons`, `members`, `managers`).

### 4.4 `ChatEmbedding` (Decision 022 — pgvector)

A third model will be needed for the RAG embedding table once pgvector is set up. Deferred to a separate migration because it requires the `pgvector` Postgres extension and a separate embedding pipeline job. The model will look roughly like:

```prisma
// Future — requires pgvector extension
model ChatEmbedding {
  id          String   @id @default(cuid())
  leagueId    String
  entityType  String   // "matchup" | "season_summary" | "manager_career" | etc.
  entityId    String
  content     String   @db.Text
  embedding   Unsupported("vector(1536)")
  createdAt   DateTime @default(now())

  @@index([leagueId, entityType])
}
```

---

## 5. iOS View Hierarchy

```
Views/
└── Chat/
    ├── ChatTabView.swift           # Tab root — thread list or empty state
    ├── ThreadListView.swift        # List of named threads, new thread button
    ├── NewThreadSheet.swift        # Modal: text field for thread name, create CTA
    ├── ChatThreadView.swift        # Full-screen chat: message list + input bar
    ├── ChatMessageBubble.swift     # Single message bubble (user / assistant styling)
    ├── ChatInputBar.swift          # TextField + send button, handles streaming lock
    └── ChatStreamingIndicator.swift # Animated typing indicator during SSE stream
```

### State and data flow

- `ChatStore` (ObservableObject or `@Observable`) owns thread list and active thread messages. Injected via environment.
- `ChatThreadView` opens an `URLSession` data task with `text/event-stream` content type for the send-message endpoint. Each `delta` event appends to a local `@State var streamingContent: String` which drives a streaming bubble in real time.
- On `done` event, the streaming bubble is replaced with the persisted message from the `messages` response (or the returned `messageId`).
- Thread list updates `updatedAt` optimistically on send.

### Navigation integration

The existing Chat tab (currently a placeholder) is replaced with `ChatTabView`. No changes to the tab bar structure are required.

### Key iOS conventions

- All new types (`ChatThread`, `ChatMessage`, `ChatThreadResponse`, etc.) added to `LeagueModels.swift`.
- `APIClient` gets new methods: `createThread`, `listThreads`, `deleteThread`, `getMessages`, and `sendMessage` (which returns an `AsyncThrowingStream<ChatDelta, Error>`).
- All views use `Theme.*` tokens — no hardcoded colors or fonts.
- Each view gets its own file in `Views/Chat/`. Run `xcodegen generate` after adding files.
- Streaming is handled via `URLSession` byte-stream, not Combine — consistent with Swift 6 concurrency model.

---

## 6. AI Architecture

### System Prompt Assembly (per request)

The system prompt is assembled from three layers, in order:

**Layer 1 — Lean Header (~200 tokens)**

```
You are a fantasy football analyst assistant for the league "{leagueName}".
This is a {provider} league (scoring: {scoringType}, {teamCount} teams).
The league has {N} seasons of history ({firstYear}–{lastYear}).
Active managers: {comma-separated manager names}.
Today's date: {date}.
Answer questions about this league's history using the available tools.
Be concise, use real names, and cite specific numbers when you make claims.
```

The header is assembled server-side from data already available in the `League`, `Season`, and `Manager` records — no extra DB queries beyond what `requireLeagueMember` already validates.

**Layer 2 — Tools (on-demand)**

Tools are thin wrappers over the V1 analytics endpoints. Each tool definition is included in the OpenAI request's `tools` array. When the model calls a tool, the server executes the corresponding Prisma query (reusing the same logic as the analytics routes) and returns the result as a tool message.

Initial tool inventory (mirrors Decision 023):

| Tool Name | Description |
|-----------|-------------|
| `get_standings` | Season standings for the league |
| `get_manager_stats` | Win/loss/points for a manager |
| `get_matchup_history` | Head-to-head record between two managers |
| `get_draft_results` | Draft picks for a season |
| `get_weekly_scores` | Scores for a week or full season |
| `get_league_records` | All-time highs and lows |
| `get_playoff_results` | Playoff bracket results |
| `get_transaction_history` | Trades and waiver activity |

All tools accept `leagueId` implicitly (scoped by the route) and optional `year` filter where the underlying endpoint supports it.

**Layer 3 — RAG (semantic retrieval)**

Before calling OpenAI, the server embeds the user's message using `text-embedding-3-small` and queries the `ChatEmbedding` table for the top-K most similar chunks scoped to the league. Relevant chunks (season summaries, notable game descriptions, career narratives) are injected as additional context after the header and before the conversation history.

RAG is optional in V2 phase 1 — the tools alone cover most questions. RAG becomes load-bearing for narrative questions ("Describe the most memorable season") that aren't well-served by structured data.

### Conversation History

The last N messages from the thread (default: 20, configurable via env var `CHAT_HISTORY_WINDOW`) are loaded from `ChatMessage` and prepended to the OpenAI messages array as `user`/`assistant`/`tool` role messages. This provides continuity within a session without unbounded context growth.

### Streaming Pipeline

```
iOS sends POST → Express handler →
  1. Persist user ChatMessage
  2. Build messages array (header + history + RAG + user turn)
  3. Call openai.chat.completions.create({ stream: true })
  4. For each chunk:
     a. If delta.content → write SSE "delta" event to response
     b. If tool_calls → execute tool, write SSE "tool_call" event, append result
  5. On stream end → persist assistant ChatMessage → write SSE "done" event
  6. res.end()
```

The Express route sets `res.setHeader('Content-Type', 'text/event-stream')` and `res.setHeader('Cache-Control', 'no-cache')` before streaming begins. The iOS `URLSession` reads the byte stream and parses SSE events from newline-delimited chunks.

---

## 7. Open Questions

1. **Tool execution during streaming** — OpenAI streams tool calls as partial JSON across multiple chunks. The server needs to buffer and assemble the full tool call JSON before executing it, then inject the result and continue the stream. This requires careful stream state management (an accumulator for in-flight tool call arguments). Complexity is non-trivial; may warrant a helper class.

2. **Multi-tool calls in one turn** — GPT-4o can emit multiple tool calls in a single response turn. The implementation needs to execute all tool calls (potentially in parallel), collect results, and send them back before the model continues generating. This is the standard OpenAI tool-use loop and must be handled correctly.

3. **RAG pipeline timing** — The embedding pipeline job (which generates `ChatEmbedding` rows) needs to run at least once per league before RAG is useful. It should trigger after a league sync completes. The trigger point (BullMQ job chaining vs. manual) is unresolved.

4. **Context budget management** — If a thread accumulates a very long history or tools return large payloads, the total token count could approach GPT-4o's context limit. A token-counting guard (using `tiktoken` or a rough heuristic) should truncate history from the oldest end before sending. Exact threshold and truncation strategy are unresolved.

5. **Error UX for stream failures** — If the SSE stream drops mid-response (network error, OpenAI timeout), the iOS client needs a graceful recovery path. Options: retry the stream from the last received token (complex), show a partial message with a retry button (simpler). Strategy unresolved.

6. **Thread title auto-generation** — Users name threads manually (Decision 028). A quality-of-life enhancement would be to auto-suggest a title from the first message (one additional OpenAI call or a simple truncation). Out of scope for V2 phase 1 but worth noting.

7. **Rate limiting** — No per-user rate limiting is specified. At production scale, an uncapped chat endpoint could generate significant OpenAI costs. A token-bucket rate limiter (e.g., via Redis) per `userId` should be considered before any public release.

8. **`userId` vs `User.id` on `ChatThread`** — The spec stores the Clerk user ID directly on `ChatThread.userId` rather than a FK to `User.id`. This is intentional (see §4.1) but means chat threads are not joined to the `User` model via Prisma relations. If cross-user admin tooling is ever needed, a migration to add the FK would be required.
