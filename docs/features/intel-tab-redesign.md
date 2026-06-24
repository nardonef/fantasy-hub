# Intel Tab Redesign — Actionable Intelligence Hub

> **Phase**: V2c
> **Status**: In progress

## Problem Statement

The current Intel tab is a generic signal history view. It shows raw signals from Reddit, FantasyPros, and SportsDataIO in chronological order, with a "Picks" section that ranks players by signal volume. The product is not actionable: it doesn't tell you what to do, and it isn't materially more useful than checking Reddit manually.

The goal is to transform the Intel tab into a **personalized fantasy intelligence hub** — one that knows your roster, your opponent, and your waiver wire, and surfaces the most relevant, actionable intelligence first.

---

## Vision: Three-Section Layout

```
┌─────────────────────────────┐
│  ⚡ Action Items             │
│  [Start Amon-Ra over Kupp]  │
│  [Add Jaylen Warren (60%)]  │
├─────────────────────────────┤
│  📰 Roster News              │
│  Signals for my players     │
│  + current week's opponent  │
├─────────────────────────────┤
│  🌐 Around the League        │
│  General signal stream      │
│  (filterable, paginated)    │
└─────────────────────────────┘
```

---

## Intelligence Card Types

The heart of the redesign is a new `IntelligenceCard` concept — a processed, typed, headline-first card generated from raw signals + roster context.

| Type | Trigger | Example Headline |
|------|---------|-----------------|
| `START_SIT` | Two same-position rostered players with diverging confidence | "Start Drake London over Jaylen Waddle" |
| `WAIVER_ALERT` | Unrostered player with ≥3 signals in last 48hrs | "Pick up Jaylen Warren — trending in 60% of leagues" |
| `INJURY_NEWS` | Injury keyword in signal for a rostered player | "Tyreek Hill listed questionable (hamstring)" |
| `RANKING_SHIFT` | FantasyPros ECR moves ≥5 spots for a rostered player | "CeeDee Lamb up 7 spots to WR1 overall" |
| `HOT_TAKE` | Reddit post ≥200 upvotes mentioning a rostered player | "Community: Puka Nacua is the WR2 of the week" |

---

## Data Flow

```
[Ingestion Adapters]           [Intelligence Engine]         [iOS]
  reddit.ts      ─┐            signal-scorer.ts              IntelView
  fantasypros.ts ─┼─ Signal ─► card-generator.ts ──► API ──► ActionItemCard
  sportsdata.ts  ─┤  table      (roster context)             RosterDigestView
  twitter.ts     ─┘                                          SignalCard (reused)
```

The intelligence engine is **stateless and request-scoped** — no new DB tables. Cards are computed dynamically from the existing `Signal` table + `roster_players` table on each API call. This keeps the schema stable and makes the engine callable as a standalone function (AI chat tool use in V3).

---

## Signal Scoring (`signal-scorer.ts`)

Scores each player's recent signals for relevance:

- **Recency decay**: last 24h = full weight, 24–48h = 0.5x, 48h–7d = 0.1x
- **Source diversity bonus**: +1 confidence point per distinct source (max 4)
- **Sentiment**: keyword scan — injury words (questionable, doubtful, out, IR, limited) = negative; positive words (breakout, must-start, hot, ranking up) = positive
- **Output**: `{ score: number, sentiment: 'positive' | 'negative' | 'neutral', confidence: 1 | 2 | 3 | 4 }`

---

## Card Generation Logic (`card-generator.ts`)

1. Fetch user's rostered player IDs from `roster_players` table
2. Fetch last 7 days of signals for all players
3. Score each rostered player via `signal-scorer`
4. Generate cards:
   - **`WAIVER_ALERT`**: unrostered players with ≥3 signals in last 48h, sorted by velocity
   - **`INJURY_NEWS`**: negative-sentiment signals for rostered players (within 24h)
   - **`RANKING_SHIFT`**: FantasyPros signals with `rankDelta ≥ 5` for rostered players
   - **`HOT_TAKE`**: Reddit signals with `score ≥ 200` for rostered players
   - **`START_SIT`**: pairs of same-position rostered players where confidence diverges by ≥2 points
5. Rank by urgency: INJURY_NEWS > START_SIT > WAIVER_ALERT > RANKING_SHIFT > HOT_TAKE
6. Return top 5 action items

The function signature is designed to be AI-tool-callable:
```typescript
generateCards(leagueId: string, userId: string): Promise<IntelligenceCard[]>
```

---

## New Data Sources

### Twitter/X via Nitter RSS (V2c)
- **File**: `api/src/ingestion/adapters/twitter.ts`
- **Method**: Scrape ~15 curated accounts' Nitter RSS feeds (`/USER/rss`)
- **Accounts**: beat reporters (`@AdamSchefter`, `@RapSheet`, `@TomPelissero`) + fantasy analysts (`@FantasyPros`, `@FFBallBobby`, `@WaiverWireKing`)
- **Signal type**: `SOCIAL_MENTION`
- **Dedup**: by tweet ID in metadata
- **Graceful degradation**: returns `[]` if all Nitter instances are unreachable
- **Future**: swap HTTP calls to Twitter v2 API when budget allows

---

## API Shape

### `GET /api/leagues/:leagueId/intelligence`

Query params:
- `weekOpponent=true` — include current-week opponent's roster in `rosterNews`

Response:
```json
{
  "actionItems": [
    {
      "type": "START_SIT",
      "headline": "Start Drake London over Jaylen Waddle",
      "body": "London has 3 sources pointing up; Waddle injury concern from 2 sources",
      "confidence": 3,
      "playerIds": ["player-123", "player-456"],
      "sources": ["reddit", "fantasypros"],
      "signalIds": ["sig-1", "sig-2", "sig-3"],
      "generatedAt": "2026-04-15T14:00:00Z"
    }
  ],
  "rosterNews": [Signal],
  "leagueSignals": [Signal],
  "nextCursor": "cursor-string | null",
  "generatedAt": "2026-04-15T14:00:00Z"
}
```

Existing feed/players/recommendations routes are unchanged and still used for player drill-down.

---

## iOS View Hierarchy

```
IntelView (replaces FeedView as tab root)
├── ActionItemsSection
│   └── ActionItemCard (per IntelligenceCard)
│       ├── START_SIT: two-player comparison row with confidence bars
│       ├── WAIVER_ALERT: player + pickup urgency indicator
│       └── INJURY/RANKING/HOT_TAKE: single player + headline + body
├── RosterDigestView
│   └── SignalCard (reused) filtered to my players + opponent
└── LeagueSignalSection
    ├── FeedFilterChip row (reused)
    └── SignalCard (reused, paginated)
```

### New files:
- `ios/FantasyHub/Views/Intel/IntelView.swift`
- `ios/FantasyHub/Views/Intel/ActionItemCard.swift`
- `ios/FantasyHub/Views/Intel/RosterDigestView.swift`

### Reused files (unchanged):
- `ios/FantasyHub/Views/Intel/SignalCard.swift`
- `ios/FantasyHub/Views/Intel/PlayerDetailView.swift`
- `ios/FantasyHub/Views/Intel/PlayerSearchView.swift`
- `ios/FantasyHub/Views/Intel/FeedFilterChip.swift`

### Modified files:
- `ios/FantasyHub/Views/MainTabView.swift` — swap `FeedView` → `IntelView`
- `ios/FantasyHub/Models/LeagueModels.swift` — add `IntelligenceCard`, `IntelligenceCardType`, `IntelligenceResponse`
- `ios/FantasyHub/Services/APIClient.swift` — add `fetchIntelligence(leagueId:)`

---

## AI Chat Integration (V3 hook)

The intelligence engine is designed to be callable as a standalone function. When V3 AI chat tool use is built, wrapping it is trivial:

```typescript
// V3: AI tool definition
{
  name: "get_intelligence",
  description: "Get personalized start/sit, waiver, and injury intelligence for a user's team",
  fn: (leagueId, userId) => generateCards(leagueId, userId)
}
```

No action required now — just ensure `card-generator.ts` doesn't depend on Express `req`/`res`.

---

## Extensibility

Adding a new data source: implement `IngestionAdapter` interface, register in `ingest-signals.ts`. No other changes needed.

Adding a new card type: add to `IntelligenceCardType` union, add generation logic in `card-generator.ts`, add a layout branch in `ActionItemCard.swift`.

Planned future sources: Bluesky, ESPN breaking news RSS, injury report PDFs, beat reporter newsletters.
