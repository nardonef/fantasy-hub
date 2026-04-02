# Dashboard Redesign — Feature Spec

> **Status**: Proposed
> **Depends on**: Manager claim flow (complete), all analytics endpoints (complete)
> **Backend changes**: 1 new endpoint (`GET /analytics/insights`)
> **iOS new files**: 5 views, 1 model file
> **iOS modified files**: `DashboardView.swift`, `APIClient.swift`, `LeagueModels.swift`

---

## Overview

The current dashboard mirrors native fantasy apps: record, standings snippet, activity feed. This redesign makes the dashboard a **narrative layer** — it tells the user things they didn't know about themselves, using data already available across 14 analytics endpoints (of which the dashboard currently uses 5).

Three features, in priority order:

1. **The Pulse** — rotating insight banner (high impact, requires new endpoint)
2. **Superlatives** — personal achievement badges (medium impact, uses existing data)
3. **Performance Sparkline** — inline weekly score trend (medium impact, uses existing data)

---

## 1. The Pulse — Insight Banner

### What it is

A full-width card at the top of the dashboard that displays one auto-generated insight at a time. Each insight is a single sentence with a highlighted stat callout. The banner auto-advances every 6 seconds and is manually swipeable. Tapping an insight navigates to the relevant analytics detail view.

### Why it matters

This is the single feature that no native fantasy app offers. Yahoo shows you your record; this tells you *"You've beaten Jake 8 of the last 9 times you've played him"*. It transforms the dashboard from a status board into a discovery engine.

### Insight Categories

Each insight has a `type` that determines its icon, accent color, and navigation target.

| Category | Example Text | Data Source | Nav Target |
|----------|-------------|-------------|------------|
| `streak` | "You've won 5 of your last 6 matchups against **Marcus**" | h2h | H2HDetailView |
| `record` | "You hold the league's 3rd highest single-week score: **167.4** (Week 8, 2023)" | records, extremes | RecordsDetailView |
| `consistency` | "Your scoring consistency is top 2 in the league (σ = 14.2)" | scoring | ScoringDetailView |
| `clutch` | "You score **+8.3 PPG** more in the playoffs than the regular season" | playoffs | PlayoffPerformanceView |
| `rivalry` | "Your closest rivalry: you and **Devon** are dead even at **7-7** all time" | h2h | H2HDetailView |
| `milestone` | "You've played **142 career matchups** — 2nd most in league history" | standings/records | StandingsDetailView |
| `comparison` | "Your PPG this year (**112.4**) is **9.1** above the league average" | scoring, dashboard | ScoringDetailView |
| `heartbreak` | "3 of your losses this season were by less than **5 points**" | extremes | RecordsDetailView (Nail Biters) |
| `dominance` | "You've won **8 straight** against the bottom 3 finishers" | h2h, standings | H2HDetailView |
| `history` | "**This week in 2023**: you scored 154.2, your season high" | scoring (weekly) | ScoringDetailView |

### Backend: `GET /analytics/insights`

**New endpoint**: `GET /api/leagues/:leagueId/analytics/insights`

Requires a claimed manager. Returns 5-8 insights, pre-ranked by interestingness. The server generates these by running lightweight queries across existing data — no new tables needed.

**Request**: No parameters beyond auth + leagueId.

**Response**:
```json
{
  "insights": [
    {
      "id": "streak-jake-2024",
      "type": "streak",
      "headline": "You've won 5 of your last 6 against Jake",
      "detail": "Your best active streak against any opponent",
      "stat": "5-1",
      "statLabel": "Last 6",
      "managerName": "Jake",
      "analyticsPath": "h2h",
      "priority": 1
    }
  ]
}
```

**Fields**:
- `id` — unique identifier for dedup
- `type` — one of the categories above (determines icon + color)
- `headline` — the primary text, max ~60 chars, **bold** segments marked with `**`
- `detail` — secondary context line, optional
- `stat` — the hero number/value to display large
- `statLabel` — label under the stat
- `managerName` — if the insight references another manager (for avatar display)
- `analyticsPath` — which analytics view to navigate to on tap
- `priority` — server-assigned rank (1 = most interesting)

**Generation logic** (server-side, in order of priority):

1. **Active streaks**: Query h2h matchups ordered by date. For each opponent, find current win/loss streak. Surface streaks ≥ 3.
2. **Record proximity**: Check if user's scores appear in the league's top 10 (records endpoint logic). Surface if rank ≤ 5.
3. **Clutch rating**: If user has playoff games, compute clutch rating. Surface if positive and top 3 in league.
4. **Close rivalries**: Find h2h records within 1 game of .500 with ≥ 6 total matchups.
5. **Consistency rank**: Rank all managers by scoring stddev. Surface if user is top 3 or bottom 3.
6. **PPG comparison**: Compare user's current/recent season PPG to league average. Surface if delta > 5.
7. **Heartbreak count**: Count losses by < 5 points in most recent season. Surface if ≥ 2.
8. **Historical echoes**: Find matchups from the same week number in prior years. Surface notable ones (high score, upset).

The server returns the top 5-8 after filtering out low-signal results. Insights are cached per user per league for 1 hour (simple in-memory TTL or Redis key).

### iOS: `InsightBannerView`

**New file**: `ios/FantasyHub/Views/Dashboard/InsightBannerView.swift`

**Layout**:
```
┌─────────────────────────────────────────────┐
│  [icon]  headline text with **bold** parts  │
│          detail text in dimText              │
│                                             │
│       ┌──────┐                              │
│       │ STAT │  statLabel                   │
│       └──────┘                              │
│                                             │
│          ○ ● ○ ○ ○    (page dots)           │
└─────────────────────────────────────────────┘
```

**Behavior**:
- `TabView` with `.tabViewStyle(.page)` for swipe
- `Timer` auto-advances every 6 seconds, pauses when user is swiping
- Tapping navigates via the `analyticsPath` field
- `headline` is parsed for `**bold**` markers → rendered as `Theme.accent` colored spans
- Icon determined by `type`:
  - `streak` → `flame.fill` (accent)
  - `record` → `trophy.fill` (accent)
  - `consistency` → `chart.line.flattrend.xyaxis` (cyan)
  - `clutch` → `bolt.fill` (accent)
  - `rivalry` → `person.2.fill` (textPrimary)
  - `heartbreak` → `heart.slash.fill` (loss)
  - `dominance` → `crown.fill` (accent)
  - `history` → `clock.arrow.circlepath` (textSecondary)
  - `milestone` → `flag.checkered` (win)
  - `comparison` → `arrow.up.right` (win) or `arrow.down.right` (loss)

**Card style**: Uses `.cardStyle()` with a subtle left border in the type's accent color (2pt, `Theme.accent` for most, `Theme.loss` for heartbreak).

### iOS Model

Add to `LeagueModels.swift`:

```swift
struct InsightItem: Identifiable, Codable {
    let id: String
    let type: InsightType
    let headline: String
    let detail: String?
    let stat: String
    let statLabel: String
    let managerName: String?
    let analyticsPath: String
    let priority: Int
}

enum InsightType: String, Codable {
    case streak, record, consistency, clutch, rivalry
    case milestone, comparison, heartbreak, dominance, history
}
```

### iOS APIClient

```swift
func getInsights(leagueId: String) async throws -> [InsightItem] {
    let response: InsightsResponse = try await request(.get, path: "/leagues/\(leagueId)/analytics/insights")
    return response.insights
}
```

### Integration in DashboardView

Insert `InsightBannerView` as the first element after the league header, before `CareerHeroCard`. Only shown when:
- Manager is claimed (`myManager != nil`)
- Insights array is non-empty

Load insights in parallel with other dashboard data in `loadData()`.

---

## 2. Superlatives — "Your Legacy" Badges

### What it is

A horizontal scroll of compact badge cards, each highlighting a personal achievement or characteristic derived from existing analytics data. These are the "Spotify Wrapped" moments — identity-defining labels people want to share.

### Why it matters

Raw stats are forgettable. "47.2% win rate" doesn't stick. But "The Closer — you win 73% of matchups decided by less than 10 points" is an identity. These are the shareable, memorable hooks that make users open the app to show their friends.

### Superlative Definitions

Each superlative has a threshold to qualify and a formula. All use data already available from existing endpoints.

| Badge | Title | Criteria | Data Source |
|-------|-------|----------|-------------|
| Iron Man | "Iron Man" | Most consecutive seasons played | standings (count seasons per manager) |
| Sniper | "The Sniper" | Lowest scoring stddev (top 2) | scoring (`consistency` field) |
| Boom or Bust | "Boom or Bust" | Highest scoring stddev (top 2) | scoring (`consistency` field) |
| Playoff Machine | "Playoff Machine" | Made playoffs ≥ 60% of seasons played | standings (`madePlayoffs`) |
| Heartbreaker | "Heartbreak Kid" | Most losses by < 5 points | extremes (`closestGames`) |
| Closer | "The Closer" | Win rate in games decided by < 10 pts > 60% | extremes |
| Dynasty | "Dynasty Builder" | Multiple championships | records (`champions`) |
| Consistent | "Mr. Reliable" | PPG within 5% of personal avg for 3+ seasons | scoring (weekly, computed) |
| Clutch | "Clutch Gene" | Positive clutch rating, top 3 | playoffs (`clutchRating`) |
| Rival Slayer | "Rival Slayer" | 70%+ win rate vs any manager with 6+ matchups | h2h |
| Underdog | "Cinderella Story" | Won championship from 8th+ regular season rank | standings + records |
| Blowout King | "Blowout Artist" | Appears 3+ times in league's top 10 blowout wins | extremes (`biggestBlowouts`) |

### No backend changes needed

All superlatives are computed client-side from data the dashboard already loads or can load in parallel. The existing endpoints provide everything:
- `getScoring(includeWeekly: false)` → consistency values
- `getExtremes(limit: 10)` → closest games, blowouts
- `getPlayoffs()` → clutch ratings
- `getRecords()` → champions, all-time records
- `getH2H()` → rival records
- `getStandings()` → already loaded

This avoids a new endpoint but means the dashboard loads more data. Mitigate by:
1. Loading superlative data lazily (after initial dashboard renders)
2. Caching results in a `@State` property so switching tabs doesn't re-fetch

### iOS: `SuperlativesView`

**New file**: `ios/FantasyHub/Views/Dashboard/SuperlativesView.swift`

**Layout** (horizontal ScrollView):
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  🎯      │  │  🔥      │  │  🏆      │
│ THE      │  │ BOOM OR  │  │ DYNASTY  │
│ SNIPER   │  │ BUST     │  │ BUILDER  │
│          │  │          │  │          │
│ σ = 12.1 │  │ σ = 28.4 │  │ 3 titles │
│ #1 in    │  │ Highest  │  │ 2019,    │
│ league   │  │ variance │  │ 2021,    │
│          │  │          │  │ 2024     │
└──────────┘  └──────────┘  └──────────┘
```

Each badge card is 130pt wide × ~140pt tall:
- SF Symbol icon at top (16pt, `Theme.accent`)
- Title in `Theme.captionFont`, uppercased, tracking 1.0, `Theme.accent`
- Subtitle/stat in `Theme.bodyFont`, `Theme.textPrimary`
- Supporting detail in `.system(size: 10)`, `Theme.dimText`
- `.cardStyle()` background

The scroll has `.scrollIndicators(.hidden)` and `Theme.spacingSM` spacing.

### iOS: `SuperlativeEngine`

**New file**: `ios/FantasyHub/Views/Dashboard/SuperlativeEngine.swift`

A pure function (no state, no views) that takes the raw data from multiple endpoints and returns an array of earned superlatives:

```swift
struct Superlative: Identifiable {
    let id: String          // e.g. "sniper"
    let title: String       // e.g. "The Sniper"
    let icon: String        // SF Symbol name
    let stat: String        // e.g. "σ = 12.1"
    let detail: String      // e.g. "#1 in league"
}

struct SuperlativeEngine {
    static func compute(
        myManagerId: String,
        scoring: [ScoringData],
        extremes: ExtremesResponse,
        playoffs: [PlayoffPerformance],
        records: RecordsResponse,
        h2h: H2HResponse,
        standings: [StandingsEntry]
    ) -> [Superlative]
}
```

The function iterates through each superlative definition, checks if the user qualifies, and returns only earned badges. Typical user earns 2-5 superlatives.

### Integration in DashboardView

Insert `SuperlativesView` after `CareerHeroCard`, before rival cards. Load the extra data (`scoring`, `extremes`, `playoffs`, `records`) in a secondary async task that fires after the primary dashboard data loads:

```swift
.task(id: dashboardData?.myManagerId) {
    guard let managerId = dashboardData?.myManagerId else { return }
    await loadSuperlatives(managerId: managerId)
}
```

This ensures the dashboard renders immediately with existing data, and superlatives appear with a subtle fade-in once computed.

---

## 3. Performance Sparkline

### What it is

A compact inline sparkline showing the user's last 15-20 weekly scores as a continuous line. No axes, no labels — just the shape of recent performance. The line is colored green when the trend is up, red when down. Sits in the `CareerHeroCard` or as a standalone thin card.

### Why it matters

Momentum is the one thing no stats table conveys. A sparkline answers "am I getting better or worse?" in a glance. Apple Watch uses this pattern for heart rate; GitHub uses it for contribution streaks. It's information-dense and takes almost no space.

### No backend changes needed

Uses `getScoring(leagueId:includeWeekly:)` with `includeWeekly: true`, filtered to the user's manager ID. The weekly scores array already contains `year`, `week`, `score` — take the last 20 entries sorted by year then week.

### iOS: `SparklineView`

**New file**: `ios/FantasyHub/Views/Dashboard/SparklineView.swift`

**Layout** (embedded in CareerHeroCard):
```
┌─────────────────────────────────────────┐
│  92-54-3  │  63%   │                    │
│  Record   │  Win%  │  ╱╲  ╱╲╱╲  ╱      │
│           │        │ ╱  ╲╱     ╲╱       │
│           │        │  last 20 weeks     │
└─────────────────────────────────────────┘
```

**Implementation**:
```swift
struct SparklineView: View {
    let scores: [Double]  // last 15-20 scores

    private var trend: Double {
        // Simple: compare avg of last 5 to avg of first 5
        guard scores.count >= 10 else { return 0 }
        let recent = scores.suffix(5).reduce(0, +) / 5
        let earlier = scores.prefix(5).reduce(0, +) / 5
        return recent - earlier
    }

    var body: some View {
        Chart(Array(scores.enumerated()), id: \.offset) { index, score in
            LineMark(
                x: .value("Week", index),
                y: .value("Score", score)
            )
            .foregroundStyle(trend >= 0 ? Theme.win : Theme.loss)
            .lineStyle(StrokeStyle(lineWidth: 1.5))

            AreaMark(
                x: .value("Week", index),
                y: .value("Score", score)
            )
            .foregroundStyle(
                .linearGradient(
                    colors: [
                        (trend >= 0 ? Theme.win : Theme.loss).opacity(0.15),
                        .clear
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: (scores.min() ?? 0) * 0.9 ... (scores.max() ?? 200) * 1.05)
        .frame(height: 40)
    }
}
```

Key details:
- Chart axes hidden — pure visual shape
- Y scale padded 5-10% so the line doesn't clip
- Area fill with gradient for subtle depth
- Trend color determined by comparing recent vs. earlier average
- Caption "last 20 weeks" in `Theme.dimText` below, optional

### Integration in CareerHeroCard

Add the sparkline as a new row at the bottom of `CareerHeroCard`, below the PPG comparison:

```swift
// In CareerHeroCard body, after PPG comparison HStack:
if let scores = recentScores, scores.count >= 5 {
    VStack(spacing: 2) {
        SparklineView(scores: scores)
        Text("Last \(scores.count) weeks")
            .font(.system(size: 9, weight: .medium))
            .foregroundStyle(Theme.dimText)
    }
}
```

The `recentScores` are passed into `CareerHeroCard` as an optional parameter, loaded from the scoring endpoint.

---

## Data Loading Strategy

The dashboard currently makes 4 parallel requests in `loadData()`. This redesign adds up to 3 more. To avoid slowing initial render:

**Phase 1 — Immediate (existing)**:
- `getStandings` → standings card
- `getRecentActivity` → activity feed
- `getMyManager` → claim check
- `getDashboard` → career hero, rivals, rank chart

**Phase 2 — Deferred (new, fires after Phase 1 completes)**:
- `getInsights` → insight banner (fade in)
- `getScoring(includeWeekly: true)` → sparkline + superlative consistency data
- `getExtremes(limit: 10)` → superlative heartbreak/blowout data

**Phase 3 — Lazy (fires only if Phase 2 data arrives)**:
- `getPlayoffs` → superlative clutch data
- `getRecords` → superlative dynasty/record data
- `getH2H` → superlative rival slayer data (already loaded for claim sheet)

H2H is already fetched in Phase 1 for the claim sheet manager list, so it's free. Scoring with weekly data is the heaviest call — only request it for the claimed manager's ID if possible, or accept the full payload.

Each phase renders independently. The dashboard never blocks on Phase 2/3 data.

---

## New Files Summary

| File | Type | Description |
|------|------|-------------|
| `Views/Dashboard/InsightBannerView.swift` | View | Swipeable insight cards with auto-advance |
| `Views/Dashboard/SuperlativesView.swift` | View | Horizontal scroll of earned badge cards |
| `Views/Dashboard/SuperlativeEngine.swift` | Logic | Pure function computing earned superlatives from endpoint data |
| `Views/Dashboard/SparklineView.swift` | View | Compact inline chart of recent scores |
| `api/src/routes/insights.ts` | Route | Insight generation endpoint |

## Modified Files Summary

| File | Changes |
|------|---------|
| `LeagueModels.swift` | Add `InsightItem`, `InsightType`, `InsightsResponse` |
| `APIClient.swift` | Add `getInsights()` method |
| `DashboardView.swift` | Add Phase 2/3 data loading, insert InsightBanner + Superlatives + Sparkline, pass `recentScores` to CareerHeroCard |
| `CareerHeroCard.swift` | Add optional `recentScores` parameter, render SparklineView |
| `api/src/routes/analytics.ts` or new `insights.ts` | Insight generation logic |
| `api/src/server.ts` | Mount insights route (if separate file) |

---

## Sequencing

| Step | Work | Depends On |
|------|------|------------|
| 1 | `SparklineView` + wire into `CareerHeroCard` | Nothing — pure iOS, uses existing scoring endpoint |
| 2 | `SuperlativeEngine` + `SuperlativesView` + wire into dashboard | Nothing — pure iOS, uses existing endpoints |
| 3 | Insights endpoint (backend) | Nothing — uses existing DB queries |
| 4 | `InsightBannerView` + wire into dashboard | Step 3 |
| 5 | Polish: animations, transition timing, edge cases | Steps 1-4 |

Steps 1 and 2 can be done in parallel. Step 3 can start in parallel with 1+2.

---

## What This Does NOT Include

- **Share/export** for superlatives (V2 social feature)
- **Push notifications** for new insights (V2)
- **Animated number transitions** on stat values (nice polish, but not in this scope — can be added later as a `.contentTransition(.numericText())` modifier)
- **Tale of the Tape** expanded rivalry view (deferred — the existing RivalCard is serviceable, and the insight banner covers rivalry narratives)
- **Season Win/Loss Heatmap** (deferred — high implementation cost for a detail that lives better in the analytics tab)
- **"This Time Last Year"** standalone card (covered by the `history` insight type in The Pulse)
