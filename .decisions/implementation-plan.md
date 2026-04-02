# Implementation Plan: Fantasy League Hub

## What We're Building
A native iOS app (SwiftUI) that connects to Yahoo, ESPN, and Sleeper fantasy football leagues, imports years of historical data, and surfaces deep analytics that no single platform provides — head-to-head rivalries, luck indexes, draft grades, scoring trends, and champion histories. An AI chat assistant understands your league's full history and answers natural language questions with rich, data-backed responses. It's a multi-user platform where leaguemates share analytics and chat.

## Decisions Made

| # | Decision | Choice | Category |
|---|----------|--------|----------|
| 1 | Platform & Frontend Stack | Option A: SwiftUI Native | Technical |
| 2 | Backend & API Architecture | Option A: Node.js Express API | Technical |
| 3 | Database & Data Modeling | Option A: PostgreSQL + Prisma ORM | Technical |
| 4 | Provider Integration Strategy | Option A: Adapter Pattern + Job Queue | Technical |
| 5 | Auth & Multi-Tenancy | Option A: Clerk + Custom League Permissions | Technical |
| 6 | AI/Chat Architecture | Option A: RAG + Tool Use (pgvector) | Technical |
| 7 | Visual Direction | Option A: Broadcast Dark + Trophy Gold | Visual |
| 8 | Navigation & App Structure | Option A: League-First Tab Bar | Information Architecture |
| 9 | Onboarding & League Connection Flow | Option A: Progressive Reveal | Interaction |
| 10 | Analytics Dashboard UX | Option A: Scrollable Category Sections | Interaction |
| 11 | AI Chat Experience | Option A: Full-Screen Chat + Contextual Triggers | Interaction |
| 12 | Phased Delivery Strategy | Option A: Analytics-First Launch | Interaction |

---

## V1 — Core Analytics (Target: ~8-10 weeks)

Ship the analytics engine with Yahoo + Sleeper. No AI chat yet.

### 1. Project Setup & Infrastructure
- [ ] Initialize SwiftUI Xcode project with iOS 17+ target
- [ ] Set up Node.js Express API (TypeScript) with project structure
- [ ] Configure PostgreSQL database with Prisma ORM schema
- [ ] Set up Redis for BullMQ job queue
- [ ] Configure Clerk authentication (iOS SDK + API middleware)
- [ ] Set up deployment pipeline (API hosting, database hosting)
- [ ] Implement Broadcast Dark + Trophy Gold design system in SwiftUI (color tokens, typography with tabular numbers, component library)

### 2. Data Layer & Provider Integration
- [ ] Design Prisma schema: users, leagues, seasons, managers, matchups, rosters, draft_picks, transactions, standings
- [ ] Build provider adapter interface (shared protocol for all providers)
- [ ] Implement Sleeper adapter (public API — no auth required)
- [ ] Implement Yahoo adapter (OAuth 2.0 flow + API integration)
- [ ] Build BullMQ job queue for background data sync
- [ ] Implement historical data import pipeline (all available seasons)
- [ ] Build incremental sync for ongoing updates
- [ ] Create league_members permissions table and invite link system

### 3. iOS App — Core Navigation & Onboarding
- [ ] Build 5-tab navigation bar (Dashboard, Analytics, AI Chat placeholder, League, Profile)
- [ ] Implement league switcher in navigation
- [ ] Build progressive reveal onboarding flow:
  - [ ] Sign up / sign in via Clerk
  - [ ] Connect provider account (Yahoo OAuth or Sleeper username)
  - [ ] Select leagues to import
  - [ ] Dashboard loads immediately with skeleton → stats animate in as import progresses
- [ ] Build league invite link flow (deep links)

### 4. Dashboard & Analytics
- [ ] Build Dashboard tab — league overview with key stats, recent activity, quick links
- [ ] Build Analytics tab — scrollable category sections with sticky season filter:
  - [ ] Standings & Rankings section (current + all-time, power rankings)
  - [ ] Head-to-Head section (rivalry records, win/loss matrix)
  - [ ] Scoring & Trends section (scoring over time, consistency ratings, luck index)
  - [ ] Draft Analysis section (draft grades, hit rates, round-by-round performance)
  - [ ] Records & Milestones section (highest score, longest win streak, champion history)
- [ ] Each section: compact preview card → "See All" pushes to full detail view
- [ ] Build Swift Charts visualizations for scoring trends, H2H heatmaps, draft grade distributions
- [ ] Implement season filter (current season / all-time / custom range)

### 5. League & Profile
- [ ] Build League tab — member list, league settings, connected providers
- [ ] Build Profile tab — user settings, connected accounts, manage leagues
- [ ] Implement manager profile views (career stats, personal records)

### 6. Polish & Launch
- [ ] End-to-end testing of Yahoo and Sleeper import flows
- [ ] Performance optimization (lazy loading, pagination for large leagues)
- [ ] Error handling for provider API failures, rate limits, stale OAuth tokens
- [ ] App Store assets, screenshots, description
- [ ] TestFlight beta with real league data
- [ ] Submit to App Store

---

## V2 — AI + Social (Post-V1 validation)

### 7. AI Chat Integration
- [ ] Set up pgvector extension for semantic search embeddings
- [ ] Build embedding pipeline: vectorize league history as data imports
- [ ] Implement RAG + Tool Use backend:
  - [ ] Define typed tools (query_standings, query_h2h, query_scoring_trends, query_draft, etc.)
  - [ ] Build context builder that assembles relevant league data for LLM calls
  - [ ] Implement pgvector semantic search for natural language → relevant data retrieval
- [ ] Build full-screen AI Chat tab in SwiftUI:
  - [ ] Conversational UI with message bubbles
  - [ ] Rich response components (inline stat cards, mini charts, data tables)
  - [ ] Follow-up suggestion pills after each response
  - [ ] Typing indicators and streaming responses
- [ ] Implement contextual "Ask AI" triggers on analytics screens
- [ ] Build conversation history and thread management

### 8. ESPN Provider
- [ ] Implement ESPN adapter (cookie-based auth, scraping where needed)
- [ ] Test ESPN historical data import across multiple seasons
- [ ] Add ESPN to onboarding flow

### 9. Social Features
- [ ] Weekly recap narrative generation (AI-powered)
- [ ] Push notifications (matchup results, record alerts, AI insights)
- [ ] Manager profile sharing (shareable cards for social media)

---

## V3 — Engagement Features (Post-V2)

### 10. Advanced Analytics & Tools
- [ ] Trade analyzer (evaluate trade proposals with historical context)
- [ ] Waiver wire recommendations (AI-powered)
- [ ] Playoff probability models (Monte Carlo simulations)
- [ ] League awards ceremony (end-of-season superlatives, auto-generated)

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **iOS App** | SwiftUI, Swift Charts, iOS 17+ |
| **API** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL, Prisma ORM, pgvector |
| **Job Queue** | BullMQ (Redis-backed) |
| **Auth** | Clerk (iOS SDK + API middleware) |
| **AI** | RAG + Tool Use, pgvector embeddings |
| **Visual** | Broadcast Dark + Trophy Gold (charcoal, warm cream, old gold) |

## Design Principles

- **Broadcast Dark + Trophy Gold** — Charcoal (#1a1a1a) backgrounds, warm cream (#e8e2d6) text, old gold (#c9a96e) accents. Scoreboard-inspired layouts, tabular numbers, ticker-style stat presentation. Feels like ESPN broadcast graphics, not a SaaS dashboard.
- **League-First Navigation** — 5-tab bar (Dashboard, Analytics, AI Chat, League, Profile) with league switcher. Everything is scoped to the active league.
- **Progressive Reveal** — Dashboard loads immediately during import. Stats animate in as historical data arrives. No blank loading screens.
- **Scrollable Analytics** — Vertical scroll through category sections with compact previews. Season filter controls the time dimension globally. Tap "See All" to drill deep.
- **Contextual AI** — Full-screen chat tab for deep conversations. "Ask AI" buttons on analytics screens pre-seed the chat with context. Follow-up suggestion pills guide exploration.

## Decision History
All decision documents are saved in the `.decisions/` folder.
Open `.decisions/index.html` in your browser to review all decisions with visuals.
