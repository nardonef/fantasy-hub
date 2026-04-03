# Architecture Overview

## System Diagram

```
┌─────────────────────────┐
│    iOS App (SwiftUI)     │
│  ┌─────────────────────┐ │
│  │  Views/Screens       │ │
│  │  ┌───────────────┐  │ │
│  │  │ Analytics      │  │ │
│  │  │ Dashboard      │  │ │
│  │  │ Chat (V2) ✅   │  │ │
│  │  │ Onboarding     │  │ │
│  │  └───────────────┘  │ │
│  ├─────────────────────┤ │
│  │  APIClient (actor)   │ │  ──── HTTPS/SSE ──▶ ┌───────────────────────────┐
│  │  LeagueStore         │ │                      │   Express API (Node.js)    │
│  │  AuthManager         │ │                      │  ┌─────────────────────┐  │
│  └─────────────────────┘ │                      │  │ Routes               │  │
└─────────────────────────┘                       │  │ /leagues             │  │
                                                  │  │ /analytics           │  │
                                                  │  │ /chat ✅             │  │
                                                  │  ├─────────────────────┤  │
                                                  │  │ Middleware           │  │
                                                  │  │ Clerk auth           │  │
                                                  │  │ League membership    │  │
                                                  │  ├─────────────────────┤  │
                                                  │  │ AI Layer ✅          │  │
                                                  │  │ prompt.ts            │  │
                                                  │  │ tools.ts (8 tools)   │  │──▶ OpenAI GPT-4o
                                                  │  │ rag.ts (pgvector)    │  │
                                                  │  ├─────────────────────┤  │
                                                  │  │ Providers            │  │
                                                  │  │ Sleeper ✅           │  │
                                                  │  │ Yahoo ✅             │  │
                                                  │  │ ESPN (V3)            │  │
                                                  │  ├─────────────────────┤  │
                                                  │  │ BullMQ Jobs          │──▶ Redis
                                                  │  │ sync-league          │
                                                  │  └─────────────────────┘  │
                                                  │             │              │
                                                  └─────────────┼──────────────┘
                                                                │
                                                                ▼
                                                       ┌──────────────┐
                                                       │  PostgreSQL   │
                                                       │  + Prisma ORM │
                                                       │  + pgvector   │
                                                       │  (ChatThread, │
                                                       │  ChatMessage) │
                                                       └──────────────┘
```

## Data Flow

### League Import Flow
1. User connects provider account (OAuth for Yahoo, username for Sleeper)
2. API calls `provider.getLeagues()` to discover available leagues
3. User selects leagues → API creates league + sync job
4. BullMQ worker picks up job, calls `provider.getSeasonData()` per year
5. Worker upserts managers, matchups, draft picks, standings into Postgres
6. iOS polls `GET /sync-status` to show import progress

### Analytics Query Flow
1. iOS `AnalyticsView` loads → calls analytics endpoints in parallel (`async let`)
2. API queries Prisma with league + year filters
3. Aggregation happens server-side (H2H matrix, scoring stats, power rankings)
4. iOS receives JSON → decodes into `Codable` models → renders SwiftUI views
5. Season filter bar changes trigger full data reload

### AI Chat Flow (V2)
1. iOS opens a named `ChatThread` via `POST /chat/threads`
2. User sends a message → iOS calls `POST /chat/threads/:id/messages`
3. API persists the user `ChatMessage`, builds the system prompt (league header ~200 tokens), loads the last 20 messages as conversation history, and optionally runs a RAG retrieval query against `ChatEmbedding`
4. API calls `openai.chat.completions.create({ stream: true, tools: [...8 tools] })`
5. OpenAI streams back chunks; the API enters an agentic loop:
   - On `delta` content → writes `data: {"type":"delta","content":"..."}` SSE event to the response
   - On `tool_calls` → buffers the full tool call JSON, executes the Prisma query, writes a `tool_call` SSE event, appends the result, re-enters the stream
6. On stream end → persists the final `ChatMessage` (role `"assistant"`) → writes `data: {"type":"done","messageId":"..."}` → closes the connection
7. iOS `URLSession AsyncBytes` reads the byte stream, parses SSE lines, appends `delta` tokens to a live streaming bubble, replaces it with the persisted message on `done`

## Provider Adapter Pattern

All providers implement `ProviderAdapter` interface:
- `getLeagues(credentials)` → discovers user's leagues
- `getSeasonData(leagueId, year, credentials)` → returns normalized season data

This lets us add new providers (ESPN) without changing the import pipeline.

## Key Design Decisions

See `.decisions/` for full decision history with rationale. Key choices:
- **SwiftUI native** over cross-platform (performance, Swift Charts, platform feel)
- **Express API** over serverless (stateful sync jobs, SSE streaming)
- **PostgreSQL + Prisma** over Supabase (full control, pgvector for AI)
- **Adapter + Job Queue** over real-time sync (reliability, progress tracking)
- **Clerk** over custom auth (speed to market, iOS SDK)
- **SSE over WebSocket** for AI streaming (stateless per-request, simpler iOS integration via `URLSession AsyncBytes`)
- **Tools over pure RAG** for AI answers (structured data answers factual questions precisely; RAG reserved for narrative queries)
- **Clerk user ID on `ChatThread`** directly (not a FK to `User.id`) — avoids a DB lookup on every chat request since the Clerk ID is present on every authenticated request
- **Persistent named threads** over ephemeral sessions — users maintain separate threads per topic, survive app restarts
