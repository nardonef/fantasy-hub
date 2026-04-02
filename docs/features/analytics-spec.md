# Analytics Feature Spec

Reference: Blake's Shoes stats page (`~/Desktop/frank/blakes-shoes/app/stats/page.tsx`)

## Overview

The Analytics tab is a vertically scrollable screen with category sections. Each section shows a compact preview with a "See All" link to a full detail view. A sticky season filter at the top controls the time dimension globally.

---

## Section 1: League Summary (top of Analytics tab)

Compact stat grid — 4 cards in a 2x2 grid.

| Metric | Source | Formula |
|--------|--------|---------|
| Seasons | `seasons` table | `COUNT(DISTINCT year)` |
| Total Games | `matchups` table | `COUNT(*)` |
| All-Time High Score | `matchups` table | `MAX(home_score, away_score)` |
| Avg PPG | `matchups` table | `AVG(all individual game scores)` |

---

## Section 2: Standings & Rankings

### Preview (Analytics tab)
Top 5 managers by record, showing rank, name, W-L, and PF.

### Detail View — two tabs:

**Standings Tab:**
Full table with columns: Rank, Avatar, Manager, W-L-T, Win%, PF, PA.
- Playoff line separator between playoff qualifiers and non-qualifiers.
- Season filter changes the view.
- All-Time aggregates across seasons.

**Power Rankings Tab:**
Composite score: 40% win%, 35% avg scoring, 25% consistency.
Cards showing rank, name, power score, record, avg pts, consistency.

---

## Section 3: Head-to-Head

### Preview (Analytics tab)
Top 3 most dominant rivalries (most lopsided records, minimum 3 games).

### Detail View:
- **Manager selector** — horizontal scroll of avatars, tap to filter.
- **Filtered view** — selected manager's record vs everyone, with win/loss bar per opponent.
- **Matrix view** — compact grid of all matchup records (scroll horizontally).

---

## Section 4: Scoring & Trends

### Preview (Analytics tab)
Horizontal bar chart — top 5 managers by average PPG.

### Detail View — three tabs:

**Overview Tab:**
- Bar chart of all managers by avg PPG with annotations.
- Cards per manager: name, games played, high score, low score, std dev.

**Trends Tab (from Blake's Shoes):**
- Line chart showing weekly scores over time.
- Manager toggles to compare up to 4 managers.
- Shows scoring arc over a season.

**Luck Index Tab (from Blake's Shoes):**
Luck = Actual Wins − Expected Wins.

Expected wins formula:
```
For each week a manager played:
  Count how many other managers scored lower that week
  Expected win = (managers beaten) / (total opponents)
Sum expected wins across all weeks
```

Display: cards per manager with actual wins, expected wins, luck score (+/-), label (LUCKY / UNLUCKY / NEUTRAL).

---

## Section 5: Draft Analysis

### Preview (Analytics tab)
Top 3 draft grades as letter grades (A+, B, C-).

### Detail View:
- **Draft Grades** — letter grade per manager based on pick performance.
  - Note: Real draft grading requires end-of-season player performance data. V1 will show pick counts and round distribution. Full grading deferred to when we have player stats.
- **Draft Board** — visual grid showing every pick (round × manager), color-coded by position.

---

## Section 6: Records & Milestones

### Preview (Analytics tab)
Champion history — last 3 champions with trophy icon and year.

### Detail View — subdivided into:

**Top Performances (from Blake's Shoes):**
Top 10 highest single-game scores. Shows: score, manager, vs opponent, opponent score, week, year.

**Bottom Performances:**
10 lowest single-game scores. Same format.

**Closest Games / Nail Biters (from Blake's Shoes):**
10 games with smallest victory margin. Shows: margin, winner score, loser score, managers, week/year, matchup type (regular/playoff).

**Biggest Blowouts (from Blake's Shoes):**
10 games with largest victory margin. Same format.

**Champion History:**
Bar chart of champion points by year. Table: year, champion name, team name, record, points.

**Score Distribution (from Blake's Shoes):**
Histogram — frequency of scores in 10-point buckets (0-70, 70-80, 80-90, ..., 150+).

---

## Section 7: Playoff Performance (from Blake's Shoes)

### Preview (Analytics tab)
Not shown in preview — lives within Records detail view or as its own section if space permits.

### Data:
- Regular season PPG vs Playoff PPG per manager.
- **Clutch Rating** = Playoff PPG − Regular Season PPG.
- Color: green (positive clutch), red (negative), gray (neutral).

---

## API Endpoints Required

All scoped to `/api/leagues/:leagueId/analytics/...`

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /standings?year=` | Built | Returns season managers with record |
| `GET /h2h?year=` | Built | Returns H2H matrix |
| `GET /scoring?year=` | Built | Returns per-manager scoring stats + weekly scores |
| `GET /draft?year=` | Built | Returns draft picks |
| `GET /records` | Built | Returns high scores, champions, all-time records |
| `GET /extremes` | **TODO** | Closest games, blowouts, top/bottom performances |
| `GET /playoffs` | **TODO** | Playoff vs regular season performance, clutch ratings |
| `GET /distribution` | **TODO** | Score distribution histogram data |

---

## Design Notes

- **Broadcast Dark + Trophy Gold** theme throughout.
- Tabular/monospaced numbers for all stats.
- Green (#4ADE80) for wins/positive, Red (#F87171) for losses/negative, Gold (#C9A96E) for accents.
- Charts use Swift Charts with dark backgrounds.
- Position colors in draft board: QB=red, RB=cyan, WR=gold, TE=green, K=purple, DEF=orange.
- Mobile-first: all sections must work on iPhone screens. Horizontal scroll for wide tables.
