# Reddit Ingestion: End-to-End

How Reddit data flows from subreddits into the Intel feed in the iOS app.

---

## 1. Data Source

Reddit's public JSON API — no OAuth, no credentials required.

**Subreddits polled:**
- `r/fantasyfootball` — general fantasy community, highest traffic
- `r/DynastyFF` — dynasty-specific analysis and player outlooks
- `r/fantasynfl` — additional general coverage

**Endpoint pattern:**
```
GET https://www.reddit.com/r/{subreddit}/hot.json?limit=25
User-Agent: FantasyHub/1.0
```

Returns the top 25 "hot" posts per subreddit. No pagination — we always read the current front page snapshot.

---

## 2. Ingestion Pipeline

### Schedule

The ingestion worker runs twice daily via BullMQ cron: **6am and 6pm**. The Reddit adapter runs alongside FantasyPros and SportsData in the same job. It can also be triggered ad-hoc by queuing a job with `{ source: "REDDIT" }`.

### Step-by-step in `RedditAdapter.fetchSignals()`

**a. Load seen post IDs**

Before fetching anything, the adapter reads the last 500 Reddit signals from the `signals` table and extracts their `metadata.postId` values into a Set. Any post already in this set is skipped — preventing duplicate signals across runs.

**b. Fetch posts per subreddit**

Calls the public `.json` endpoint for each of the 3 subreddits. Each subreddit fetch is wrapped in a try/catch — if one subreddit returns a 404 or rate-limits, it is skipped with a warning and the others continue.

**c. Noise filter**

Posts with fewer than **50 upvotes** are dropped. This filters out low-engagement content and focuses on posts the community has validated.

**d. Player name extraction**

For each qualifying post, the adapter scans `title + selftext[:500]` using an n-gram approach:

1. Tokenize the text (strip non-alpha characters, split on whitespace)
2. For each position, test 3-gram and 2-gram candidate spans (3-gram first to catch "Travis Hunter Jr." before "Travis Hunter")
3. Pre-filter: skip candidates where the first token doesn't start with an uppercase letter
4. Run each candidate through **player resolution** (see below)
5. If resolved, add the raw name to the `found` set — then `break` to avoid double-counting overlapping spans

Returns a deduplicated list of raw player name strings found in the post.

**e. Player resolution** (`player-resolution.ts`)

Three-step resolution strategy for each candidate name:

| Step | Method | Notes |
|------|--------|-------|
| 1 | Exact alias lookup in `player_name_aliases` | O(1), fast path |
| 2 | Case-insensitive exact match on `players.full_name` | Handles "patrick mahomes" → "Patrick Mahomes" |
| 3 | Levenshtein distance ≤ 2 against all ~2,000 NFL players | Catches minor typos, abbreviations |

On steps 2 and 3, if resolved, the alias is saved so future lookups for that exact string are instant. Ambiguous fuzzy matches (multiple players at the same distance) are rejected and the signal is dropped.

**f. Signal assembly**

For each resolved player name in a post, one `RawSignal` is emitted:

```ts
{
  rawPlayerName: "Travis Hunter",
  source: "REDDIT",
  signalType: "SOCIAL_MENTION",
  content: post.title,            // the post headline
  metadata: {
    postId: "abc123",             // Reddit's base-36 post ID
    score: 3081,                  // upvotes at time of ingestion
    numComments: 847,
    subreddit: "fantasyfootball",
    permalink: "https://reddit.com/r/fantasyfootball/comments/..."
  },
  publishedAt: new Date(post.created_utc * 1000)
}
```

If a post mentions 3 players, 3 separate signals are created — one per player.

---

## 3. Persistence

`ingest-signals.ts` calls `persistSignals(rawSignals)`:

1. Re-runs player resolution on `rawPlayerName` → gets canonical `player.id`
2. Drops any signal where resolution fails (returns `null`)
3. Creates one `signals` row per signal:

```sql
INSERT INTO signals (player_id, source, signal_type, content, metadata, published_at)
VALUES (...)
```

The `fetched_at` column is set by the DB default (`now()`).

An `ingestion_jobs` row is upserted per source with `status`, `records_fetched`, and `last_run_at` for monitoring.

---

## 4. Feed API

**`GET /api/leagues/:leagueId/feed`**

Signals are served via cursor-based pagination ordered by `fetched_at DESC`. The feed endpoint supports filtering by:

| Parameter | Effect |
|-----------|--------|
| `source=REDDIT` | Only Reddit signals |
| `type=SOCIAL_MENTION` | All social signals (Reddit + Bluesky) |
| `position=WR` | Only WRs |
| `myRosterOnly=true` | Only players on the user's current roster |
| `cursor=<ISO timestamp>` | Next page |

For `myRosterOnly`, the API calls `getRosterPlayerIds(leagueId, userId)` which reads from the `roster_players` table, then adds a `player.id IN [...]` clause to the Prisma query.

---

## 5. iOS Display

### Feed tab — Signal Card (`SignalCard.swift`)

Each Reddit signal renders as a card in the unified signal stream:

- **Left border**: orange (Reddit's accent color, defined on `SignalSource.REDDIT`)
- **Player name + position badge + NFL team**
- **Top-right badge**: "Reddit" label in orange with a speech bubble icon
- **Relative timestamp**: "2h ago", "just now", etc.
- **Body**: the post title (raw `content` field)

Tapping a signal card navigates to `PlayerDetailView` for that player.

### Feed tab — filter chips

The "Social" chip filters `type=SOCIAL_MENTION`, which surfaces Reddit (and eventually Bluesky) signals. The "Reddit" source chip filters to `source=REDDIT` specifically.

### Picks tab — Recommendation Card (`RecommendationCard.swift`)

Players with multiple signals across sources in the last 7 days surface on the Picks tab. The confidence score is the count of **distinct sources** (1–4 dots). A player mentioned in both Reddit and FantasyPros gets 2 dots; one with Reddit + FantasyPros + SportsData gets 3.

The source chips at the bottom of each card show which sources contributed — a Reddit chip appears when `sources` includes `"REDDIT"`.

---

## 6. Key Constraints and Limits

| Constraint | Value | Reason |
|------------|-------|--------|
| Posts per subreddit | 25 | Reddit's practical hot-feed size |
| Min upvotes | 50 | Noise filter |
| Seen post window | 500 recent signals | Dedup lookups |
| Text scanned per post | title + 500 chars of selftext | Performance |
| N-gram size | 2–3 tokens | Covers "Travis Hunter" and "Travis Hunter Jr." |
| Levenshtein threshold | ≤ 2 edits | Catches typos; rejects ambiguous matches |
| Run frequency | 2× daily | Tied to ingestion cron (6am/6pm) |

---

## 7. What Gets Dropped

Reddit signals are dropped (never persisted) when:
- Post was already ingested (post ID in seen set)
- Post has fewer than 50 upvotes
- No player names resolved from the post text
- Player name is ambiguous at Levenshtein distance ≤ 2 (multiple players match)

The signal is silently skipped in all these cases. The `ingestion_jobs.records_fetched` count only reflects successfully persisted signals.
