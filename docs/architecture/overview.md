# Architecture Overview

## System Diagram

```
┌─────────────────────┐
│   iOS App (SwiftUI)  │
│  ┌───────────────┐  │
│  │  Views/Screens │  │
│  │  ┌──────────┐ │  │
│  │  │ Analytics │ │  │
│  │  │ Dashboard │ │  │
│  │  │ Onboard   │ │  │
│  │  └──────────┘ │  │
│  ├───────────────┤  │
│  │  APIClient     │  │  ──── HTTPS ────▶ ┌──────────────────────┐
│  │  (actor)       │  │                    │  Express API (Node)  │
│  ├───────────────┤  │                    │  ┌────────────────┐  │
│  │  LeagueStore   │  │                    │  │  Routes         │  │
│  │  AuthManager   │  │                    │  │  /leagues       │  │
│  └───────────────┘  │                    │  │  /analytics     │  │
└─────────────────────┘                    │  ├────────────────┤  │
                                           │  │  Middleware      │  │
                                           │  │  Clerk auth     │  │
                                           │  │  League access  │  │
                                           │  ├────────────────┤  │
                                           │  │  Providers       │  │
                                           │  │  Sleeper ✅      │  │
                                           │  │  Yahoo (partial)│  │
                                           │  │  ESPN (V2)      │  │
                                           │  ├────────────────┤  │
                                           │  │  BullMQ Jobs    │──▶ Redis
                                           │  │  sync-league    │
                                           │  └────────────────┘  │
                                           │          │            │
                                           └──────────┼────────────┘
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │  PostgreSQL   │
                                              │  + Prisma ORM │
                                              │  (+ pgvector  │
                                              │    in V2)     │
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

## Provider Adapter Pattern

All providers implement `ProviderAdapter` interface:
- `getLeagues(credentials)` → discovers user's leagues
- `getSeasonData(leagueId, year, credentials)` → returns normalized season data

This lets us add new providers (ESPN) without changing the import pipeline.

## Key Design Decisions

See `.decisions/` for full decision history with rationale. Key choices:
- **SwiftUI native** over cross-platform (performance, Swift Charts, platform feel)
- **Express API** over serverless (stateful sync jobs, WebSocket potential)
- **PostgreSQL + Prisma** over Supabase (full control, pgvector for V2)
- **Adapter + Job Queue** over real-time sync (reliability, progress tracking)
- **Clerk** over custom auth (speed to market, iOS SDK)
