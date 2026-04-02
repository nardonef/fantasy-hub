# Fantasy League Hub — Progress Tracker

> **Last updated**: 2026-03-26
> **Current phase**: V1 — Core Analytics
> **Goal**: Ship Yahoo + Sleeper with full analytics, no AI

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
- [ ] App Store assets and submission
- [ ] TestFlight beta

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

## V2 — AI + Social (not started)

- [ ] pgvector setup + embedding pipeline
- [ ] RAG + Tool Use backend
- [ ] Full-screen AI Chat tab
- [ ] Contextual "Ask AI" triggers
- [ ] ESPN adapter
- [ ] Weekly recap generation
- [ ] Push notifications
- [ ] Manager profile sharing
- [ ] Manager identity merging / alias system (consolidate fragmented accounts from users who recreated Sleeper/Yahoo accounts across seasons)

## V3 — Engagement (not started)

- [ ] Trade analyzer
- [ ] Waiver wire recommendations
- [ ] Playoff probability models
- [ ] League awards ceremony
