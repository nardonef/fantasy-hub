# Intelligence Layer

> **Status**: Complete — shipped in V2b  
> **iOS tab**: Intel (5th tab, `antenna.radiowaves.left.and.right` icon)  
> **Decisions**: 013–019 in `.decisions/`

---

## Product Overview

The Intelligence Layer surfaces real-time player signals — ranking changes, social buzz, and statistical performance — directly in the app. It answers the question every fantasy manager has during the week: *"What's the word on this player right now?"*

Rather than checking FantasyPros, Reddit, and box scores in separate tabs, the Intel feed aggregates all of it into a single chronological stream, color-coded by source. The Picks section goes one step further: it identifies players with cross-source consensus (the same player trending on Reddit *and* moving up the ECR rankings) and surfaces them as high-confidence recommendations.

### Core user flows

1. **Scan the feed** — open Intel, scroll the ranked/social signal stream, filter by source or signal type
2. **Drill into a player** — tap any signal card to see that player's full signal history
3. **Check picks** — switch to the Picks tab for players with multi-source signal activity, sorted by confidence
4. **Search a player** — tap the search icon to look up any NFL player by name and see their signal history

---

## Architecture

```
External sources
  FantasyPros ECR ──┐
  Reddit ───────────┤  Ingestion Adapters
  SportsDataIO ─────┤  (src/ingestion/adapters/)
  Bluesky (TBD) ────┘
         │
         ▼
  Player Resolution           Alias table + Levenshtein ≤ 2
  (src/ingestion/player-resolution.ts)
         │
         ▼
  signals table (PostgreSQL)
         │
         ▼
  Feed API endpoints          /api/leagues/:id/feed
  (src/routes/feed.ts)        /api/leagues/:id/recommendations
  (src/routes/players.ts)     /api/players/search
                              /api/players/:playerId
         │
         ▼
  iOS Intel Tab               FeedView → SignalCard
  (Views/Feed/)               FeedView → RecommendationCard → PlayerDetailView
                              PlayerSearchView → PlayerDetailView
```

---

## Data Model

### `players` table

Seeded from the Sleeper public roster API (~3,090 NFL players). Serves as the canonical identity for all signal attribution.

| Column | Type | Notes |
|---|---|---|
| `id` | cuid | Primary key |
| `full_name` | string | Canonical name, unique |
| `position` | string? | QB / RB / WR / TE / K / DEF |
| `nfl_team` | string? | Team abbreviation (KC, SF, etc.) |
| `status` | string | active / injured / ir / inactive |

### `player_name_aliases` table

Self-building lookup table that maps raw name variants to canonical player IDs. Populated on first resolution of any new name variant, so repeated ingestion of the same source is O(1) after the first run.

| Column | Type | Notes |
|---|---|---|
| `alias` | string | Raw name from source, unique |
| `player_id` | FK → players | |
| `source` | string | Which adapter created this alias |

### `signals` table

The core event store. Every ingested piece of intelligence is a signal row.

| Column | Type | Notes |
|---|---|---|
| `id` | cuid | Primary key |
| `player_id` | FK → players | |
| `source` | enum | REDDIT / BLUESKY / SPORTSDATA / FANTASYPROS |
| `signal_type` | enum | RANKING_CHANGE / SOCIAL_MENTION / STATS_UPDATE / RECOMMENDATION |
| `content` | text | Human-readable description |
| `metadata` | json | Source-specific data (rank delta, upvotes, stat line, etc.) |
| `published_at` | timestamp | When the original content was published |
| `fetched_at` | timestamp | When the adapter ingested it (used for cursor pagination) |

Indexes: `(player_id, published_at)` for player detail queries; `(source, fetched_at)` for feed queries.

### `ingestion_jobs` table

Tracks per-adapter run history: last run time, records fetched, error state.

---

## Ingestion Pipeline

### Overview

Ingestion runs as a BullMQ job (`ingest-signals`) scheduled twice daily (6am and 6pm) via cron in `server.ts`. The worker iterates through all registered adapters, calls `fetchSignals()` on each, runs player resolution on each raw signal, and persists to the `signals` table.

```typescript
// src/jobs/ingest-signals.ts
for (const adapter of ADAPTERS) {
  const rawSignals = await adapter.fetchSignals();
  const persisted = await persistSignals(rawSignals);
}
```

Each adapter implements the `IngestionAdapter` interface:

```typescript
interface IngestionAdapter {
  readonly source: SignalSource;
  fetchSignals(): Promise<RawSignal[]>;
}

interface RawSignal {
  rawPlayerName: string;  // unresolved, passed to player-resolution.ts
  source: SignalSource;
  signalType: SignalType;
  content: string;
  metadata?: Record<string, unknown>;
  publishedAt: Date;
}
```

### Player Resolution (`src/ingestion/player-resolution.ts`)

Resolves a raw name string to a `player.id` in three steps:

1. **Alias exact lookup** — `PlayerNameAlias` table, O(1) indexed. Fast path for names seen before.
2. **Full name exact match** — case-insensitive match against `Player.fullName`.
3. **Levenshtein fuzzy match** — compares against all ~3,090 players, accepts distance ≤ 2. Only resolves if the best match is unambiguous (exactly one player at that distance). On success, saves the alias for future runs.

Returns `null` if unresolvable. Unresolved signals are silently dropped — better to miss a signal than to misattribute it to the wrong player.

### Deduplication

Each adapter is responsible for its own dedup strategy via a `metadata.dedupeKey`. The `persistSignals` function handles the unique constraint on `(player_id, source, dedupeKey)` — duplicate keys are silently ignored (`P2002`).

| Adapter | Dedup key |
|---|---|
| FantasyPros | `{fantasypros_player_id}:{YYYY-MM-DD}` — one ranking signal per player per calendar day |
| SportsDataIO | `{player_id}:{season}:{week}` — one stats signal per player per game week |
| Reddit | Post ID — one signal per Reddit post |

### Adapters

#### FantasyPros (`src/ingestion/adapters/fantasypros.ts`)

Scrapes the ECR (Expert Consensus Rankings) cheatsheet page. No credentials required.

- **URL**: `https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php`
- **Method**: Extracts the `var ecrData = {...};` JavaScript variable from the page HTML. Slices to the `};` assignment terminator (not `</script>`, which may contain additional variables).
- **Signal type**: `RANKING_CHANGE`
- **Content format**: `"{name} ↑{n} to {posRank} (overall #{ecr})"` or `"{name} ranked {posRank} (overall #{ecr})"` if no delta
- **Metadata**: `fantasyprosId`, `rankEcr`, `posRank`, `rankDelta`, `lastUpdated`
- **Volume**: ~310 signals per run (365 ECR players minus ~55 unresolvable)

#### SportsDataIO (`src/ingestion/adapters/sportsdata.ts`)

Pulls weekly player game stats from the SportsDataIO v3 NFL API. Requires `SPORTSDATA_API_KEY`.

- **Endpoints**: `GET /v3/nfl/scores/json/CurrentSeason`, `GET /v3/nfl/scores/json/CurrentWeek`, `GET /v3/nfl/stats/json/PlayerGameStatsByWeek/{season}/{week}`
- **Signal type**: `STATS_UPDATE`
- **Threshold**: Only persists signals for players with ≥ 5 PPR fantasy points (filters out inactive/minimal contributions)
- **Offseason guard**: Returns no signals if week is 0 or > 18
- **Content format**: `"{name}: {rush/rec/pass stats} — {ppr_pts} PPR pts (Week {n})"`

#### Reddit (`src/ingestion/adapters/reddit.ts`)

Fetches hot posts from fantasy football subreddits via OAuth client credentials. Requires `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`.

- **Subreddits**: r/fantasyfootball, r/DynastyFF, r/NFLFantasy
- **Method**: Hot posts, extracts player name mentions via n-gram matching against the player roster
- **Signal type**: `SOCIAL_MENTION`
- **Dedup**: Post ID stored in metadata

#### Bluesky

Planned, not implemented. Adapter stub exists in the roadmap.

---

## API Endpoints

All feed and recommendation endpoints require authentication (`requireAuth`) and league membership (`requireLeagueMember`). Player endpoints require authentication only.

### `GET /api/leagues/:leagueId/feed`

Cursor-paginated signal stream. Returns signals across all players, newest first.

**Query params**

| Param | Type | Description |
|---|---|---|
| `source` | string? | Filter: `REDDIT \| BLUESKY \| SPORTSDATA \| FANTASYPROS` |
| `type` | string? | Filter: `RANKING_CHANGE \| SOCIAL_MENTION \| STATS_UPDATE \| RECOMMENDATION` |
| `playerId` | string? | Filter to a single player's signals |
| `position` | string? | Filter by player position: `QB \| RB \| WR \| TE \| K \| DEF` |
| `myRosterOnly` | boolean? | If `true`, restricts signals to players on the authenticated user's current roster. Sleeper leagues only — falls back to all players for Yahoo/non-Sleeper leagues. Roster resolved via Sleeper public API (`/league/{id}/rosters`), cached 1 hour in Redis. |
| `limit` | number? | Results per page (default 20, max 100) |
| `cursor` | string? | ISO fetchedAt of the last item from prior page |

**Response**

```json
{
  "signals": [
    {
      "id": "...",
      "source": "FANTASYPROS",
      "signalType": "RANKING_CHANGE",
      "content": "Patrick Mahomes ↑1 to QB1 (overall #1)",
      "metadata": { "rankDelta": 1, "rankEcr": 1, "posRank": "QB1" },
      "publishedAt": "2026-04-13T12:00:00Z",
      "fetchedAt": "2026-04-13T12:01:00Z",
      "player": {
        "id": "...",
        "fullName": "Patrick Mahomes",
        "position": "QB",
        "nflTeam": "KC"
      }
    }
  ],
  "nextCursor": "2026-04-13T12:01:00.000Z"  // null if no more pages
}
```

**Pagination**: Pass `nextCursor` as `cursor` on the next request. Cursor is the `fetchedAt` ISO string of the last item on the page. Uses `fetchedAt < cursor` (strictly before) to advance.

---

### `GET /api/leagues/:leagueId/recommendations`

Players ranked by cross-source signal activity in the last 7 days. Confidence = number of distinct sources with signals for that player in the window (max 4).

**Query params**: `limit` (default 20, max 50)

**Response**

```json
{
  "recommendations": [
    {
      "player": { "id": "...", "fullName": "Patrick Mahomes", "position": "QB", "nflTeam": "KC" },
      "signalCount": 3,
      "confidence": 2,
      "sources": ["REDDIT", "FANTASYPROS"],
      "latestSignal": {
        "id": "...",
        "signalType": "SOCIAL_MENTION",
        "content": "Mahomes looking sharp in OTAs...",
        "publishedAt": "...",
        "fetchedAt": "..."
      }
    }
  ],
  "since": "2026-04-06T..."
}
```

**Sorting**: Primary sort by `confidence` (distinct sources) descending; secondary sort by `signalCount` descending.

---

### `GET /api/players/search?q=`

Case-insensitive player name search. Minimum 2 characters, returns up to 10 results.

**Response**

```json
[
  { "id": "...", "fullName": "Lamar Jackson", "position": "QB", "nflTeam": "BAL" }
]
```

---

### `GET /api/players/:playerId`

Player profile with their 50 most recent signals, ordered by `publishedAt` descending.

**Response**

```json
{
  "id": "...",
  "fullName": "Patrick Mahomes",
  "position": "QB",
  "nflTeam": "KC",
  "status": "active",
  "signals": [
    {
      "id": "...",
      "source": "FANTASYPROS",
      "signalType": "RANKING_CHANGE",
      "content": "Patrick Mahomes ↑1 to QB1 (overall #1)",
      "publishedAt": "..."
    }
  ]
}
```

---

## iOS Views (`ios/FantasyHub/Views/Feed/`)

### `FeedView`

Root view of the Intel tab. Houses the Feed/Picks segmented picker and delegates to sub-content views.

**State**
- `section: FeedSection` — `.feed` or `.picks`
- `sourceFilter: SignalSource?` — active source filter chip
- `typeFilter: SignalType?` — active type filter chip
- `positionFilter: String?` — active position chip (QB/RB/WR/TE/K)
- `myRosterOnly: Bool` — `true` by default; restricts feed to user's current roster
- `signals: [Signal]` — loaded signal cards
- `nextCursor: String?` — pagination cursor
- `recommendations: [RecommendationItem]` — Picks content

**Data loading**
- `.task(id: section)` — reloads on tab switch
- `.task(id: sourceFilter)` / `.task(id: typeFilter)` / `.task(id: positionFilter)` / `.task(id: myRosterOnly)` — reloads on filter change
- Infinite scroll: `onAppear` on the last signal card triggers `loadMore()`

**Filter row layout** (horizontal scroll):
1. "My Roster" toggle chip (gold when active, default on)
2. Divider
3. Position chips: QB, RB, WR, TE, K
4. Divider
5. Type chips: Rankings, Stats, Social
6. Divider
7. Source chips: Reddit, FantasyPros, SportsData, Bluesky

**`FeedFilterChip`** — source/type/position filter pill. Active state fills with the chip's accent color; inactive shows a faint border. Tapping a chip that's already active deactivates it (toggle behavior).

### `SignalCard`

One row in the feed. Renders a 3px left border in the source's accent color.

**Layout**: Left border → (source badge + relative time) + player name + position pill + content text

**Source colors**
| Source | Color |
|---|---|
| Reddit | `#FF4500` |
| FantasyPros | `#4ADE80` |
| SportsData | `#9B59B6` |
| Bluesky | `#0085FF` |

**Relative time**: Computed from `publishedAt` — "2m ago", "3h ago", "2d ago".

Wrapped in a `NavigationLink` to `PlayerDetailView`.

### `RecommendationCard`

Card in the Picks section. Shows the player, confidence meter, and source chips.

**`ConfidenceMeter`** — 4 dots in a row. The first `confidence` dots are filled gold; the rest are empty. Represents 1–4 distinct sources with recent signals.

Tapping navigates to `PlayerDetailView` via `navigationDestination(isPresented:)`.

### `PlayerDetailView`

Full signal history for a single player.

**`PlayerHeroSection`** — position badge (colored circle matching position: QB=red, RB=cyan, WR=gold, TE=green), player name, team, signal count.

**`PlayerSignalRow`** — same left-border treatment as `SignalCard`. Source badge, relative time, content text.

Loaded via `GET /api/players/:playerId`. Shows skeleton while loading; empty state ("No signals yet") if the player has no signals.

### `PlayerSearchView`

Full-screen search sheet. Accessible from the search icon in the Intel tab navigation bar.

- Debounced on `onChange(of: searchText)` with 2-character minimum
- Results show position color circle + player name + team
- Tapping a result pushes `PlayerDetailView`

---

## iOS Models (`LeagueModels.swift`)

```swift
// Source and type enums — match API enums exactly
enum SignalSource: String, Codable { case reddit = "REDDIT", bluesky = "BLUESKY", sportsData = "SPORTSDATA", fantasyPros = "FANTASYPROS" }
enum SignalType: String, Codable   { case rankingChange = "RANKING_CHANGE", socialMention = "SOCIAL_MENTION", statsUpdate = "STATS_UPDATE", recommendation = "RECOMMENDATION" }

// Feed response
struct Signal: Codable, Identifiable { id, source, signalType, content, metadata, publishedAt, fetchedAt, player: FeedPlayer }
struct FeedResponse: Codable         { signals: [Signal], nextCursor: String? }

// Picks response
struct RecommendationItem: Codable, Identifiable { player, signalCount, confidence, sources, latestSignal }
struct RecommendationsResponse: Codable          { recommendations: [RecommendationItem], since: String }

// Player detail
struct PlayerDetail: Codable   { id, fullName, position, nflTeam, status, signals: [PlayerSignal] }
struct PlayerSignal: Codable   { id, source, signalType, content, publishedAt }

// Search
struct PlayerSearchResult: Codable, Identifiable { id, fullName, position, nflTeam }
```

`SignalSource` and `SignalType` carry computed properties used throughout the UI:
- `displayName` — human label ("FantasyPros", "Reddit", etc.)
- `accentColor` — source brand color as `Color`
- `systemIcon` — SF Symbol name per signal type

---

## Known Limitations

- **Feed league-scoping is Sleeper-only** — the `myRosterOnly` filter resolves rosters via the Sleeper public API. Yahoo leagues fall back to showing all players. Roster is from the current season's Sleeper league (`league.providerLeagueId` = current-year league ID). The `players.metadata.sleeperId` field is used to map Sleeper player IDs to our `players` table rows (backfilled via `scripts/seed-players.ts`).
- **No pull-to-refresh on PlayerDetailView** — must navigate away and back to reload.
- **FantasyPros scraper is fragile** — depends on page structure (`var ecrData = {...};`). If FantasyPros changes their page layout, the `parseEcrData` method in `fantasypros.ts` will need updating.
- **Reddit and SportsDataIO require credentials** — not yet configured in `.env`. See `docs/dev-mode.md` for setup.
- **Cron resets on API restart** — the BullMQ cron job is re-registered each time `server.ts` starts. In production, use a persistent scheduler or ensure the API has minimal restarts.
