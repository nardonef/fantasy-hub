# Fantasy League Hub — Progress Tracker

> **Last updated**: 2026-04-13
> **Current phase**: V2b — Intelligence Layer (active, post-QA enhancements)
> **Goal**: Intelligence feed layer with signals from Reddit, FantasyPros, SportsDataIO; Feed/Picks tabs; player search and detail

---

## V1 — Core Analytics

### 1. Project Setup & Infrastructure

- [x] Initialize SwiftUI Xcode project (iOS 17+, Swift 6.0, XcodeGen)
- [x] Set up Node.js Express API (TypeScript) with project structure
- [x] Design Prisma schema (users, leagues, seasons, managers, matchups, standings, draft_picks, transactions, sync_jobs)
- [x] Configure BullMQ job queue with Redis connection
- [x] Scaffold Clerk auth middleware (Express side)
- [x] Implement Broadcast Dark + Trophy Gold design system (`Theme.swift`)
- [x] Provision PostgreSQL database and run `prisma migrate` (postgresql@17, fantasy_hub db, 13 tables)
- [x] Set up Redis instance (redis 8.6.1 via Homebrew)
- [x] Configure Clerk project (real API keys in api/.env, dev bypass auto-disables)
- [ ] Set up deployment pipeline (API hosting)

### 2. Data Layer & Provider Integration

- [x] Build provider adapter interface (`src/providers/types.ts`)
- [x] Implement Sleeper adapter (full: leagues, matchups, draft picks, standings)
- [x] Scaffold Yahoo adapter (OAuth flow + partial league discovery)
- [x] Build BullMQ sync job (`src/jobs/sync-league.ts`) with retry/progress tracking
- [x] Build adapter registry (`src/providers/index.ts`)
- [x] Complete Yahoo adapter `getSeasonData()` (standings, matchups, draft picks, transactions)
- [x] Build incremental sync (mode: full|incremental, skips past seasons, POST /sync endpoint)
- [x] Implement invite link system (API: generate/preview/join endpoints, iOS: deep links via fantasyhub:// URL scheme, InviteView, share sheet)
- [x] Fix Yahoo manager identity mapping — nickname-based identity keys instead of unstable numeric slot IDs (`yahoo.ts`, `types.ts`)
- [x] Add full-sync data cleanup — wipe all league data before re-import when identity keys change (`sync-league.ts`)
- [x] Add transaction persistence to sync job (`sync-league.ts`)
- [x] Compute `madePlayoffs` from PLAYOFF/CHAMPIONSHIP matchup participation (`sync-league.ts`)
- [x] Persist `seasonLeagueIds` in league metadata and pass through on re-sync (`leagues.ts`)

### 3. iOS App — Core Navigation & Onboarding

- [x] Build 5-tab navigation (Dashboard, Analytics, Chat placeholder, League, Profile) + hidden native tab bar fix
- [x] Build league switcher in navigation
- [x] Build progressive onboarding flow (welcome → provider → connect → select → import)
- [x] Build sign-in view
- [x] Integrate Clerk iOS SDK (ClerkKit + ClerkKitUI, real auth via AuthView, session tokens for API requests)
- [x] Build league invite link flow (deep links via fantasyhub://invite/{code})
- [x] Implement skeleton → stats animate-in during import (ImportProgressView with staged animations)

### 4. API — Analytics Endpoints ✅ COMPLETE

- [x] `GET /standings` — season standings with year filter
- [x] `GET /h2h` — head-to-head matrix from matchup data
- [x] `GET /scoring` — per-manager stats (avg, max, min, stddev, weekly scores)
- [x] `GET /draft` — draft picks with manager/season data
- [x] `GET /records` — highest scores (both home+away), champions, all-time win leaders, uses season team names
- [x] `GET /extremes` — top/bottom performances, closest games, biggest blowouts, uses season team names
- [x] `GET /playoffs` — regular vs playoff PPG, clutch ratings
- [x] `GET /distribution` — score histogram in 10-point buckets

### 5. iOS — Dashboard

- [x] League header card (name, provider badge, stats)
- [x] Quick standings card (top 5)
- [x] Quick stats grid (2×2: matchups, seasons, avg score, championships)
- [x] Recent activity feed (RecentActivityCard with type-specific icons)
- [x] Progressive loading with skeleton states

### 6. iOS — Analytics Tab (Main View) ✅ COMPLETE

- [x] Scrollable category sections layout
- [x] Sticky season filter bar (All-Time + per-year chips)
- [x] Standings preview (top 5 by record)
- [x] H2H preview (top 3 dominant rivalries)
- [x] Scoring preview (bar chart, top 5 avg PPG)
- [x] Draft preview (top 3 draft grades)
- [x] Records preview (last 3 champions)
- [x] Playoff preview (top 3 clutch ratings)
- [x] "See All" NavigationLinks wired to detail views

### 7. iOS — Analytics Detail Views ✅ COMPLETE

- [x] **Standings** — Full table (rank, avatar, name, W-L-T, PF, PA, playoff line) + Power Rankings tab
- [x] **H2H** — Manager selector, individual breakdown with win/loss bars, full matrix
- [x] **Scoring** — Overview tab (bar chart + stat cards), Trends tab (line chart with manager toggles), Luck Index tab
- [x] **Draft** — Draft grades (letter grades) + Draft board (round × manager grid, position-colored)
- [x] **Records** — 7-tab view: Top Scores, Bottom Scores, Nail Biters, Blowouts, Champions, Distribution, Clutch
- [x] **League Summary** — 4-card 2×2 grid (seasons, total games, all-time high, avg PPG)
- [x] **Playoff Performance** — Standalone section with clutch bar chart, highlights, full breakdown

### 8. iOS — League & Profile ✅ COMPLETE

- [x] League tab (info, manager grid, invite button)
- [x] Profile tab (connected accounts, league list, settings sections, sign out)
- [x] Manager profile views (career stats grid, season-by-season table, personal records)

### 9. Analytics UI Overhaul & Personal Dashboard

- [x] **H2H Heatmap** — full-screen heatmap grid with win-rate color gradient (red→neutral→green), tap-to-select detail cards, manager initial headers
- [x] **Mini Heatmap Preview** — 5x5 color grid in Analytics hub H2H section preview
- [x] **H2HDetailView Picker** — Heatmap (default) and Breakdown tabs
- [x] **Scoring Trends Enhancement** — continuous multi-season x-axis with season boundary rules, 4-week rolling average overlay, Season PPG toggle with per-season line chart, peak/valley PointMark annotations
- [x] **Season Averages** — computed `seasonAverages` property on ScoringData
- [x] **Visual Hierarchy** — `AnalyticsSection` prominence parameter (featured/standard), `rankAccentStyle` view modifier (gold left border for rank 1), colored W-L records in standings
- [x] **Card Audit** — converted 7 detail views from per-row `.cardStyle()` to grouped tables with alternating row backgrounds (PerformanceList, GameResultList, DraftGrades, LuckIndex, ClutchRating, H2H matchups, ScoringOverview stats, Champions, PlayoffBreakdown)
- [x] **Theme Tokens** — `winRateColor()` gradient function, `heatmapEmpty`, `borderGold`, `RankAccentModifier`
- [x] **User-to-Manager Mapping** — `userId` FK on Manager model, Prisma migration
- [x] **Manager Claim API** — `PUT /managers/:managerId/claim`, `GET /my-manager` endpoints
- [x] **Dashboard API** — `GET /analytics/dashboard` with career stats, rival records, rank history, PPG comparison
- [x] **Manager Claim Flow** — `ManagerClaimView` sheet with manager list, claim action
- [x] **Personal Dashboard** — `CareerHeroCard` (all-time W-L-T, win rate, championships, PPG), `RivalCard` (best/worst rival with W-L bars), `RankTrajectoryChart` (inverted y-axis rank line chart), claim banner CTA
- [x] **Dashboard Models** — `DashboardData`, `DashboardRecord`, `RankHistoryEntry`, `RivalRecord` Codable types
- [x] **Highlighted Standings** — user's claimed manager highlighted in dashboard standings

### 9b. Dashboard Redesign — Insights, Superlatives, Sparkline

- [x] **Dashboard Redesign Spec** — `docs/features/dashboard-redesign-spec.md` with API schemas, view layouts, data loading strategy
- [x] **Insights Backend** — `GET /analytics/insights` endpoint with 7 generators (streaks, rivalries, consistency, clutch, records, PPG comparison, heartbreak), 1-hour in-memory cache
- [x] **Insight Models** — `InsightsResponse`, `InsightItem`, `InsightType` enum (10 types) in `LeagueModels.swift`
- [x] **InsightBannerView** — swipeable `TabView` with page style, auto-advance timer (6s), page dots, colored left border per type, `**bold**` headline parsing
- [x] **SparklineView** — compact inline chart (Swift Charts) of last 20 weekly scores, trend-colored area fill (green up, red down)
- [x] **SuperlativeEngine** — pure function computing earned badges from scoring, extremes, playoffs, records, H2H data (9 badge types: Sniper, Boom or Bust, Playoff Machine, Dynasty Builder, Clutch Gene, Rival Slayer, Heartbreak Kid, Blowout Artist, Iron Man)
- [x] **SuperlativesView** — horizontal `ScrollView` of badge cards with "YOUR LEGACY" section header
- [x] **CareerHeroCard Sparkline** — integrated `SparklineView` into existing career card with "Last N weeks" label
- [x] **Dashboard Phased Loading** — Phase 2 data loading (insights, scoring with weekly, extremes, playoffs, records) after dashboard loads, superlative computation
- [x] **API Key Fix** — `leagueAvgPPG`→`leagueAvgPpg` / `myAvgPPG`→`myAvgPpg` camelCase fix in `analytics.ts` for Swift `.convertFromSnakeCase` decoding
- [x] **Simulator Validated** — all 3 features rendering correctly with real league data (Blake's Shoes, 14 seasons)

### 9c. Auth Session Handling

- [x] **401 Retry with Token Refresh** — `APIClient.request()` retries once on 401 with refreshed Clerk token, coalesces concurrent refresh calls via `activeRefreshTask`
- [x] **`APIError.sessionExpired`** — new error case thrown only after retry fails, with `isAuthError` computed property
- [x] **Session Expiry Signaling** — `AsyncStream<Void>` from APIClient to AuthManager crosses actor boundary cleanly
- [x] **AuthManager Listener** — `@Published var sessionExpired` driven by `AsyncStream`, `acknowledgeSessionExpiry()` for dismiss
- [x] **Root-Level Alert** — `.alert("Session Expired")` on `FantasyHubApp` root Group — overlays current screen, no abrupt navigation
- [x] **Zero View Changes** — all retry/expiry logic centralized in APIClient + AuthManager, no individual view modifications needed

### 9d. Sleeper Adapter Fixes

- [x] **Full Season Discovery** — `getLeagues()` now follows `previous_league_id` chain to discover all historical seasons (was limited to 3 years)
- [x] **`seasonLeagueIds` for Sleeper** — maps year → Sleeper league ID (like Yahoo), so sync uses correct league ID per season
- [x] **Bracket-Based Champion Detection** — `getSeasonData()` uses `/winners_bracket` endpoint to find actual playoff champion (was incorrectly using regular-season #1 seed)
- [x] **Sync Route Season Merge** — `POST /sync` merges seasons from DB with `seasonLeagueIds` metadata, so newly discovered seasons are included in re-syncs
- [x] **BIG12 Re-sync Validated** — 4 seasons (2022-2025), correct champions (franknardone 2022+2024), 30-26-0 all-time record, all features rendering in simulator with real Clerk auth

### 10. Polish & Launch

- [x] End-to-end testing with real Sleeper league data (BIG12 league: 12 managers, 98 matchups, 36 draft picks — all 8 analytics endpoints verified)
- [x] End-to-end testing with real Yahoo league data (Blake's Shoes: 12 managers, 98 matchups, 192 draft picks, 686 transactions — Yahoo OAuth + adapter verified)
- [x] Re-sync Blake's Shoes with nickname-based identity fix (31 managers: 15 core + 16 one-season anon/hidden profiles, 3466 transactions imported, correct champion attribution)
- [x] Performance optimization (lazy per-section loading in AnalyticsView, paginated activity feed, API pagination on activity/extremes/scoring)
- [x] Error handling (ErrorStateView with retry on all analytics + dashboard views)
- [x] Loading states on all analytics detail views + analytics main view
- [x] Fix year display formatting — no comma separators (2025 not 2,025)
- [x] Fix native tab bar bleeding through behind custom tab bar
- [x] Shimmer/skeleton loading states (ShimmerView + DashboardSkeleton, AnalyticsSkeleton, StandingsSkeleton, GenericListSkeleton)
- [ ] Production deployment — see blockers below before starting
  - [ ] Replace hardcoded `http://localhost:3000/api` in `APIClient.swift` with build-config-driven URL (Debug vs Release xcconfig)
  - [ ] Remove self-signed HTTPS server on port 3443 in `server.ts`; use TLS termination at load balancer instead
  - [ ] Update `YAHOO_REDIRECT_URI` and Yahoo developer console to production domain
  - [ ] Obtain missing credentials: `REDDIT_CLIENT_ID/SECRET`, `SPORTSDATA_API_KEY`, Clerk production keys
  - [ ] Choose infra stack (Railway/Render recommended: managed Postgres + Redis, auto-deploy from GitHub)
  - [ ] Run `prisma migrate deploy` against production DB
  - [ ] Apple Developer account + App Store Connect setup, TestFlight, App Store review

### 10. Documentation & Tooling ✅ COMPLETE

- [x] CLAUDE.md with project context, conventions, key files
- [x] docs/progress.md living progress tracker
- [x] docs/features/analytics-spec.md feature spec
- [x] docs/architecture/overview.md system diagram
- [x] docs/architecture/api-endpoints.md endpoint reference
- [x] 8 custom slash commands (.claude/commands/)
- [x] 4 memory files for cross-session persistence
- [x] Codebase validation pass (all types aligned, nav links resolved, theme consistent)

---

## V2 — AI Chat ✅ COMPLETE (pending iOS end-to-end test)

### Decisions (025–028)
- [x] Decision 025 — Conversation History Storage: Persistent DB Threads (ChatThread + ChatMessage)
- [x] Decision 026 — Streaming: SSE Token Streaming (typewriter effect via `text/event-stream`)
- [x] Decision 027 — Context Injection: Lean Header (~200 tokens) + Tools (on-demand) + RAG
- [x] Decision 028 — Threading Model: User-Named Threads per league

### API — Chat Endpoints ✅ COMPLETE
- [x] `POST /chat/threads` — create named thread (title, 120 char max)
- [x] `GET /chat/threads` — list user's threads, ordered by updatedAt desc
- [x] `DELETE /chat/threads/:threadId` — delete thread + messages (403 if not owner)
- [x] `POST /chat/threads/:threadId/messages` — SSE stream with OpenAI agentic loop
- [x] `GET /chat/threads/:threadId/messages` — paginated history (limit/before cursor)

### AI Layer ✅ COMPLETE
- [x] `src/lib/ai/prompt.ts` — lean system prompt builder (<300 tokens)
- [x] `src/lib/ai/tools.ts` — 8 tool definitions + executors (get_standings, get_manager_stats, get_matchup_history, get_draft_results, get_weekly_scores, get_league_records, get_playoff_results, get_transaction_history)
- [x] `src/lib/ai/rag.ts` — pgvector RAG retrieval with graceful degradation when table absent
- [x] Agentic loop in `chat.ts` — multi-turn tool accumulation, parallel execution, MAX_TOOL_ITERATIONS=8 guard

### iOS — Chat UI ✅ COMPLETE
- [x] `ChatTabView` — replaces placeholder Chat tab, lists leagues
- [x] `ThreadListView` — thread list with message count badge, delete swipe, new thread button
- [x] `NewThreadSheet` — modal text field for thread name
- [x] `ChatThreadView` — full-screen chat with SSE streaming via `URLSession AsyncBytes`
- [x] `ChatMessageBubble` — user (right, gold) and assistant (left, surface) bubble styles
- [x] `ChatInputBar` — send/stop button, streaming lock
- [x] `ChatStreamingIndicator` — animated typing dots
- [x] `StreamingMessageBubble` — live token accumulation bubble
- [x] `ChatSSEEvent` — enum with `parse(from:)` for `data: {"type":...}` JSON lines

### Data Model ✅ COMPLETE
- [x] `ChatThread` — userId (Clerk ID), leagueId, title, timestamps, messages relation
- [x] `ChatMessage` — threadId, role, content, toolName?, toolCallId?, createdAt
- [x] Schema applied via `prisma db push`

### Spec & Docs ✅ COMPLETE
- [x] `docs/features/ai-chat-spec.md` — full spec (API shape, data model, iOS view hierarchy, AI architecture)

### Verification ✅ ALL PASSING
- [x] `verify-tools.ts` — all 8 tools fire against real league data (10/10 checks pass)
- [x] SSE smoke test — full HTTP → OpenAI → SSE → DB pipeline verified end-to-end
- [x] `verify-sse-tools.ts` — per-tool coverage sweep, 8/8 tools route correctly via natural language

### Remaining
- [ ] iOS end-to-end test with real Clerk auth (requires build + simulator run)
- [ ] RAG embedding pipeline — `ChatEmbedding` table population (deferred, tools cover most questions)
- [ ] ESPN adapter
- [ ] Weekly recap generation
- [ ] Push notifications
- [ ] Manager profile sharing
- [ ] Manager identity merging / alias system

## V2b — Intelligence Layer / Social Feed (planned, not started)

> All decisions made (013–019). Build order: API ingestion jobs → Prisma schema → player resolution → iOS feed tab → player detail view.

### Decisions (013–019)
- [x] Decision 013 — Ingestion Data Model: Typed Signal Family (`Signal`, `Player`, `PlayerNameAlias`, `IngestionJob` tables)
- [x] Decision 014 — Data Source APIs: Free stack (Reddit OAuth, Bluesky AT Protocol, SportsDataIO free tier, FantasyPros scraping)
- [x] Decision 015 — Player Resolution: Alias Table + Exact-First (Levenshtein ≤ 2, self-building `PlayerNameAlias` cache)
- [x] Decision 016 — Navigation Integration: Add Sixth Tab (Feed tab housing Feed, Recommendations, Player Detail)
- [x] Decision 017 — Feed View Design: Unified Card Stream (single chronological list, source color-coded left borders, filter chips)
- [x] Decision 018 — Recommendations Card Design: Confidence-Scored (3-dot signal strength indicator, source count, speculative vs consensus)
- [x] Decision 019 — Player Detail Layout: Stats Hero + Signal Feed (sticky stats block, chronological signal feed scrolls below)

### 1. Data Layer — Prisma Schema & Ingestion
- [x] Prisma schema: `Player`, `PlayerNameAlias`, `Signal`, `IngestionJob` tables + `SignalSource`/`SignalType` enums (`prisma db push` applied)
- [x] Prisma client regenerated
- [x] Ingestion adapter interface (`src/ingestion/types.ts`) — `RawSignal`, `IngestionAdapter`
- [x] Player resolution pipeline (`src/ingestion/player-resolution.ts`) — alias exact lookup → case-insensitive exact → Levenshtein ≤ 2 → null
- [x] Reddit ingestion adapter (`src/ingestion/adapters/reddit.ts`) — OAuth client credentials, r/fantasyfootball + r/DynastyFF + r/NFLFantasy, player name extraction via ngram resolution, dedup via stored post IDs
- [x] `ingest-signals` BullMQ job + worker (`src/jobs/ingest-signals.ts`) — runs all adapters, persists resolved signals, tracks `IngestionJob` status
- [x] Cron schedule wired in `server.ts` (6am/6pm daily, only starts if `REDDIT_CLIENT_ID` set)
- [x] Test infrastructure: Vitest + @vitest/coverage-v8, `npm test` script, dotenv setup for integration tests
- [x] Tests: `levenshtein` unit (8 cases), `resolvePlayer` integration (6 cases, real DB), `RedditAdapter` unit — player extraction + dedup (7 cases) — **21/21 passing**
- [ ] Add `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` to `api/.env` (create OAuth app at reddit.com/prefs/apps)
- [x] Seed `Player` table with current NFL roster — `scripts/seed-players.ts` via Sleeper public API, 3090 players, position picks first fantasy-relevant value (handles two-way players like Travis Hunter)
- [x] Tests: seed eligibility filter (6 unit), DB state post-seed (5 integration) — **32/32 passing across all test files**
- [ ] Build Bluesky ingestion adapter (`src/ingestion/adapters/bluesky.ts`)
- [x] Build SportsDataIO ingestion adapter (`src/ingestion/adapters/sportsdata.ts`) — weekly `PlayerGameStatsByWeek` stats; ≥5 PPR pt threshold; dedup by `playerId:season:week`; guarded by `SPORTSDATA_API_KEY` env var; offseason-safe (skips week 0 / week > 18)
- [x] Tests: `buildContent` QB/WR/RB/edge (7 unit), `hasFantasyRelevantStats` (4 unit), `fetchSignals` offseason/dedup/threshold/error (6 unit) — **62/62 passing across all test files**
- [x] Build FantasyPros scraping adapter (`src/ingestion/adapters/fantasypros.ts`) — scrapes `var ecrData` JSON from ECR page; deduplication via `player_id:date` key; registered in `ingest-signals.ts`; cron always scheduled (no credentials needed)
- [x] Tests: FantasyPros `parseEcrData` (5 unit), `buildContent` (4 unit), `fetchSignals` dedup + error (3 unit) — **44/44 passing across all test files**

### 2. API — Feed & Player Endpoints
- [x] `GET /api/leagues/:leagueId/feed` — cursor-paginated signal stream; filters: source, type, playerId, limit; joined player data
- [x] `GET /api/leagues/:leagueId/feed` — added `myRosterOnly=true` filter (Sleeper league roster via public API; Redis-cached 1h; falls back to all-players for Yahoo leagues)
- [x] `GET /api/leagues/:leagueId/feed` — added `position=QB|RB|WR|TE|K|DEF` filter
- [x] `GET /api/leagues/:leagueId/recommendations` — top players by signal activity (last 7 days); confidence = distinct source count
- [x] `GET /api/players/search?q=` — case-insensitive name search, min 2 chars, max 10 results
- [x] `GET /api/players/:playerId` — player profile + 50 most recent signals ordered by publishedAt
- [x] Tests: feed (19 integration, including position + myRosterOnly), recommendations (4), search (6), player detail (4) — **90/90 passing across all test files**
- [x] Backfilled `sleeperId` into `players.metadata` — `scripts/seed-players.ts` now stores Sleeper player IDs; re-run is idempotent
- [x] `roster_players` table — Prisma schema + `prisma db push` applied; stores current-season roster per manager with slot (STARTER/BENCH/IR/TAXI) and FK to `players`
- [x] `ProviderRosterPlayer` interface + optional `getCurrentRoster()` on `ProviderAdapter`
- [x] Sleeper adapter `getCurrentRoster()` — reads `/league/{id}/rosters`, assigns slots from `starters`/`reserve`/`taxi` arrays
- [x] Yahoo adapter `getCurrentRoster()` — reads `/league/{id}/teams;out=roster`, parses `selected_position` for slot, uses existing manager identity key resolution
- [x] Sync job (`sync-league.ts`) — calls `getCurrentRoster()` after all seasons are imported; wipes and replaces roster snapshot; resolves Sleeper player IDs via `metadata.sleeperId`, Yahoo via name match; non-fatal if it fails
- [x] `src/lib/roster.ts` — rewritten to read from `roster_players` DB table; no live API calls; returns null if roster not yet synced (graceful fallback to all players)

### 3. iOS — Feed Tab (6th Tab)
- [x] Add Intel tab (6th) to custom tab bar — `antenna.radiowaves.left.and.right` icon
- [x] `FeedView` — unified card stream with Feed/Picks segment picker; source + type filter chips (horizontal scroll); cursor-based infinite scroll; empty states
- [x] `SignalCard` — left border color-coded by source; position pill; source badge + relative time
- [x] `RecommendationCard` — 4-dot confidence meter (distinct source count); source chips; taps to PlayerDetailView
- [x] `FeedFilterChip` — active/inactive states with tint color; icon support
- [x] `PlayerSearchView` — debounced name search via `/api/players/search`; results list with position circles
- [x] `PlayerDetailView` — position circle hero; signal count; chronological `PlayerSignalRow` feed; skeleton loading
- [x] Feed models added to `LeagueModels.swift`: `Signal`, `FeedPlayer`, `FeedResponse`, `RecommendationItem`, `LatestSignal`, `PlayerDetail`, `PlayerSignal`, `PlayerSearchResult`, `SignalSource`, `SignalType` enums
- [x] Feed/player API methods added to `APIClient.swift`: `getFeed`, `getRecommendations`, `searchPlayers`, `getPlayer`
- [x] `getFeed` updated with `position` and `myRosterOnly` params
- [x] `FeedView`: "My Roster" toggle chip (default on); QB/RB/WR/TE/K position chips; both wired to feed reload
- [x] `xcodegen generate` run; `BUILD SUCCEEDED`

### 4. QA — Simulator Validation ✅ COMPLETE
- [x] Feed tab renders with live seeded signals (Reddit + FantasyPros + SportsData)
- [x] Filter chips: Rankings → only RANKING_CHANGE signals; Social → only SOCIAL_MENTION signals; All → resets
- [x] Signal card tap → PlayerDetailView (correct position badge, signal count, signal rows with source colors)
- [x] Back navigation from PlayerDetailView → Feed
- [x] Picks tab: RecommendationCard with 3-dot confidence meter + source chips (Reddit/FantasyPros/SportsData)
- [x] Search icon → PlayerSearchView with debounced search
- [x] Player search results → PlayerDetailView (Lamar Jackson with 0 signals empty state)
- [x] Back navigation from PlayerDetailView → PlayerSearchView

### 5. V2 Social Phase (post-AI chat)
- [ ] Weekly recap narrative generation (AI-powered, reuses chat LLM infrastructure)
- [ ] Push notifications — Direct APNs via `node-apn` (Decision 024)
  - [ ] `device_tokens` Prisma table
  - [ ] iOS: register for notifications, store token via API
  - [ ] BullMQ notification job (weekly recap ready, AI insight alerts)
- [ ] Manager profile sharing (shareable cards for social media)
- [ ] Manager identity merging / alias system

---

## V3 — Engagement (not started)

- [ ] Trade analyzer
- [ ] Waiver wire recommendations
- [ ] Playoff probability models
- [ ] League awards ceremony

---

## Future Enhancements (no priority order)

### Intelligence Layer
- [x] **Roster as core data** — `roster_players` table stores current-season roster for all managers, synced as part of the league sync job. Both Sleeper and Yahoo supported. `roster.ts` reads from DB, no live API calls.
- [ ] **Roster staleness indicator** — `syncedAt` is stored per row but the UI doesn't surface it. Could show "last updated X hours ago" or auto-trigger a roster refresh when > 24h stale.
- [ ] **Reddit + SportsDataIO credentials** — add `REDDIT_CLIENT_ID/SECRET` and `SPORTSDATA_API_KEY` to `api/.env` to enable those adapters. Reddit: create OAuth app at reddit.com/prefs/apps. SportsDataIO: free tier key from sportsdata.io.
- [ ] **Bluesky ingestion adapter** — stub planned, not implemented.
- [ ] **"My Roster" filter on Picks tab** — currently only applies to the Feed section. Picks (recommendations) always show all players.
