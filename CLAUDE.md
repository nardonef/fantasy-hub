# Fantasy League Hub

Multi-platform fantasy football analytics iOS app. Connects to Yahoo, ESPN, and Sleeper to aggregate years of league history into deep analytics, with an AI chat assistant (V2).

## Project Structure

```
fantasy-hub/
├── api/                    # Node.js Express API (TypeScript)
│   ├── prisma/             # Database schema
│   ├── src/
│   │   ├── jobs/           # BullMQ background jobs (sync-league)
│   │   ├── lib/            # Shared utilities (prisma, redis)
│   │   ├── middleware/     # Auth (Clerk), league membership
│   │   ├── providers/      # Adapter pattern: sleeper.ts, yahoo.ts
│   │   ├── routes/         # Express routes (leagues, analytics)
│   │   └── server.ts       # Entry point
│   └── tsconfig.json
├── ios/                    # SwiftUI iOS app
│   ├── FantasyHub/
│   │   ├── App/            # Entry point (FantasyHubApp.swift)
│   │   ├── Design/         # Theme.swift — design system tokens
│   │   ├── Models/         # LeagueModels.swift — all Codable types
│   │   ├── Services/       # APIClient, AuthManager, LeagueStore
│   │   └── Views/          # SwiftUI views by feature area
│   │       ├── Analytics/  # All analytics detail views
│   │       ├── Dashboard/  # Dashboard tab
│   │       ├── League/     # League tab
│   │       ├── Onboarding/ # Onboarding + sign-in flow
│   │       ├── Profile/    # Profile tab + manager profiles
│   │       └── Shared/     # LoadingView, EmptyStateView, etc.
│   └── project.yml         # XcodeGen project definition
├── docs/                   # Living documentation
│   ├── progress.md         # ✅ PROGRESS TRACKER — update after completing work
│   ├── features/           # Feature specs
│   └── architecture/       # System design docs
└── .decisions/             # Decision history (HTML + JSON archive)
```

## Key Files to Know

- **Progress tracker**: `docs/progress.md` — check this first to understand what's done and what's next
- **Analytics spec**: `docs/features/analytics-spec.md` — detailed spec for all analytics sections
- **Implementation plan**: `.decisions/implementation-plan.md` — original V1/V2/V3 plan with all decisions
- **Design tokens**: `ios/FantasyHub/Design/Theme.swift` — all colors, fonts, spacing
- **Data models**: `ios/FantasyHub/Models/LeagueModels.swift` — all shared Swift types
- **API routes**: `api/src/routes/analytics.ts` — all analytics endpoints
- **DB schema**: `api/prisma/schema.prisma` — full data model
- **Architecture**: `docs/architecture/overview.md` — system diagram, data flows

## Tech Stack

| Layer | Tech |
|-------|------|
| iOS | SwiftUI, Swift Charts, iOS 17+, Swift 6.0 |
| API | Node.js, Express, TypeScript |
| DB | PostgreSQL, Prisma ORM |
| Queue | BullMQ (Redis) |
| Auth | Clerk (iOS SDK + Express middleware) |
| AI (V2) | RAG + Tool Use, pgvector |

## Local Development

### Prerequisites
```bash
brew services start postgresql@17   # PostgreSQL on localhost:5432
brew services start redis            # Redis on localhost:6379
```

### Database
- Database: `fantasy_hub`, user: `fnardone` (no password), 13 tables
- Connection: `postgresql://fnardone@localhost:5432/fantasy_hub?schema=public`
- Migrate: `cd api && npx prisma migrate dev --name <description>`
- Generate client: `cd api && npx prisma generate`

### API
```bash
cd api && npm install && npm run dev   # Starts on port 3000
```
- `.env` must exist in `api/` with DATABASE_URL, REDIS_URL, and Clerk keys
- Clerk keys are placeholders until clerk.com is configured

### Stopping services
```bash
brew services stop postgresql@17
brew services stop redis
```

## Design System — Broadcast Dark + Trophy Gold

- Background: `#1A1A1A` (charcoal)
- Text primary: `#E8E2D6` (warm cream)
- Accent: `#C9A96E` (old gold)
- Win: `#4ADE80` (green), Loss: `#F87171` (red), Tie: `#FBBF24` (yellow)
- All stats use tabular/monospaced numbers
- Position colors: QB=red, RB=cyan, WR=gold, TE=green, K=purple, DEF=orange

## Conventions

### iOS (SwiftUI)
- Use `Theme.*` tokens for all colors, fonts, and spacing — never hardcode
- Use `.cardStyle()` and `.sectionHeaderStyle()` view modifiers from Theme
- All network types must be `Codable` and live in `LeagueModels.swift`
- API methods live in `APIClient.swift` (actor-based singleton)
- Views organized by feature: `Views/Analytics/`, `Views/Dashboard/`, etc.
- After adding new Swift files, run `xcodegen generate` to update the Xcode project
- Build with: `xcodebuild -project FantasyHub.xcodeproj -scheme FantasyHub -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build`

### API (Node.js)
- TypeScript strict mode (except `noImplicitAny: false` for Prisma workaround)
- Routes in `src/routes/`, middleware in `src/middleware/`
- Provider adapters implement the `ProviderAdapter` interface from `src/providers/types.ts`
- All analytics endpoints scoped to `/api/leagues/:leagueId/analytics/...`
- Prisma client imported from `src/lib/prisma.ts`

### Documentation
- **Always update `docs/progress.md`** after completing a feature or significant chunk of work
- Feature specs go in `docs/features/`
- Architecture docs go in `docs/architecture/`
- **Every major technical decision must be documented** in `.decisions/` (via better-plan-mode) before implementation begins — covers LLM provider, schema design, API contracts, infra choices, and any decision with non-obvious tradeoffs
- **Every significant new feature must have a spec** in `docs/features/` before implementation — spec covers: problem statement, API shape, data model changes, iOS view hierarchy, and open questions
- "Major" means: affects the data model, introduces a new dependency, changes an API contract, or requires more than a day of work

## Current Phase

We are in **V1 — Core Analytics**. V1 ships Yahoo + Sleeper with full analytics, no AI.
Check `docs/progress.md` for exact status.

## What NOT to Do

- Don't add AI/chat features yet — that's V2
- Don't implement ESPN adapter yet — that's V2
- Don't hardcode colors/fonts — use Theme tokens
- Don't create Swift files without running `xcodegen generate` after
- Don't define views inline in other view files — each view gets its own file in the appropriate feature directory
- Don't modify `.decisions/` files — that's a historical archive
- Don't implement a major feature without a spec in `docs/features/` first
- Don't make a significant technical decision without documenting it in `.decisions/` first
