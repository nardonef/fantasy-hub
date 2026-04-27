# Handoff: Today's Briefing + Player Detail Sheet

## Overview

Two connected pieces of design work for the **Intel → My Team** tab of the FantasyHub iOS app:

1. **Today's Briefing** — an AI-synthesized top-3 takeaways hero that replaces the "Action Items" list at the top of the My Team tab. Three synthesis-style variations are provided (Editorial, Scorecard, Narrative Stream); pick one to ship, or ship a user-preference toggle.
2. **Player Detail Sheet** — a redesigned player detail view that consolidates all signals for a player into a chronological timeline, adds an AI summary, and exposes quick actions (bench / trade / drop / mute). Opens from any briefing takeaway, signal card, or roster tap.

This handoff is scoped to those two screens. The broader audit (dashboard, analytics, standings, chat, profile redesigns) lives in `FantasyHub Audit.html` at the project root — feel free to browse, but the commitments here are just the two screens above.

## About the design files

The `.html` and `.jsx` files in this folder are **design references**, not production code. They render as a Figma-style pan/zoom canvas so reviewers can compare variations side-by-side.

**Your job:** recreate these designs in the existing SwiftUI codebase at `ios/FantasyHub/`, using the established patterns — `Theme.*` tokens, `APIClient` actor, `Codable` types in `LeagueModels.swift`, feature-folder view organization. Do **not** port HTML/CSS — translate the visual and interaction intent into idiomatic SwiftUI.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and layout are specified precisely. Where a value isn't in `Theme.swift` today (e.g. the 62% / 38% cream opacities, or the new `bgElev1`/`bgElev2` surfaces), add it to `Theme.swift` as part of this work.

## Existing code to touch

| File | Change |
|---|---|
| `ios/FantasyHub/Views/Feed/IntelMyTeamView.swift` | **Replace** the `actionItemsSection` with a new `TodaysBriefingView`. Keep `rosterSection` below. |
| `ios/FantasyHub/Views/Feed/ActionItemCard.swift` | Can be removed once the briefing replaces action items — or kept for "Across the league" reuse. |
| `ios/FantasyHub/Views/Feed/PlayerDetailView.swift` | **Rework** to match the new sheet design. Keep `PlayerHeroSection` but restructure below it. |
| `ios/FantasyHub/Design/Theme.swift` | **Extend** with new tokens (see Design Tokens below). |
| `ios/FantasyHub/Models/LeagueModels.swift` | **Add** `BriefingTakeaway` + `AISummary` Codables (see Data Model below). |
| `ios/FantasyHub/Services/APIClient.swift` | **Add** `fetchBriefing(leagueId:)` and `fetchPlayerAISummary(playerId:)`. |

Run `xcodegen generate` after adding new files.

---

## Screen 1 — Today's Briefing (pick one variation)

Entry point: **Intel tab → My Team segment**, replaces the `ACTION ITEMS` section at the top.

All three variations render the same underlying data — `TodaysBriefingResponse { synthesizedAt: Date, signalCount: Int, sourceCount: Int, takeaways: [BriefingTakeaway] }`. They differ only in voice and visual density.

### Shared masthead (all variations)

- Eyebrow: `TODAY'S BRIEFING · THU · WEEK 14` — 11pt, 700 weight, 1.4 letter-spacing, `Theme.accent` (old gold)
- Subtitle line: `Synthesized at 9:14am from 47 signals across FantasyPros, ESPN, Rotoworld, r/fantasyfootball, and 12 beat reporters.` — 12pt, `Theme.textSecondary`

### Shared data per takeaway (`BriefingTakeaway`)

```
- tag: "SIT" | "ADD" | "WATCH" | "START" | "DROP" | "TRADE"
- tone: Color (derived from tag — SIT/DROP=loss red, ADD/START=win green, WATCH/TRADE=tie gold)
- player: FeedPlayer
- headline: String (short imperative — "Sit Mac Jones — stream Brissett instead")
- rationale: String (1–2 sentence synthesis)
- projectedDelta: String ("−6.2 pts" | "+3.4 pts" | "TBD")
- confidence: Int (0–4) — rendered as a 4-dot scale
- sources: [SourceReference]  // { kind: injury|rank|startsit|reddit|twitter|news, label: String }
- rank7d: [Int]  // last 7 days of consensus rank for the 7-day sparkline
```

### Variation A — Editorial

**Voice:** sports-section front page. One hero card, two numbered briefs below.

**Lead card (1st takeaway)**

- Full-bleed rounded container, 20pt radius
- Background: `linear-gradient(145deg, <tone>@16% 0%, <surface> 55%)` over `Theme.cardSurface`
- Border: 0.5pt `hairlineStrong` (a new token: `Color.warmCream.opacity(0.14)`)
- Padding: 18/20/14pt
- Top row: flat-color tag badge (tag text in 10pt 800 weight on `tone` fill, `#1A1A1A` text), position/team eyebrow, confidence dots on the right
- Headline: 20pt, 700 weight, -0.3 letter-spacing, 1.25 line-height, `Theme.textPrimary`
- Rationale: 13pt, `Theme.textSecondary`, 1.5 line-height
- Source chips strip (see Source chip spec below)
- Footer divider (0.5pt hairline), then: label `PROJECTED IMPACT` + big `projectedDelta` in tone color (Fraktion Mono / SF Mono 20pt tabular), plus a gold `Apply change →` button (10pt radius, `Theme.accent` fill, `#1A1A1A` text, 12pt 700 weight)

**Briefs (takeaways 2 and 3)**

- Horizontal list item, 36pt left gutter containing the stat number in tone color (Fraktion Mono 26pt)
- Below the number, a 1pt vertical rule in `hairline` color (visually threads the list)
- Right column: tag badge (outlined variant — 1px border at 40% tone), position/team eyebrow, `projectedDelta` right-aligned in tone color
- Headline 15pt 600 weight, rationale 12pt dim, 2 source chips + `+N more` label

### Variation B — Scorecard

**Voice:** trading dashboard. Numbers-first, dense, every takeaway is a self-contained card.

**Top bar**

- Left: eyebrow + "Your roster in 3 moves" (18pt 700)
- Right: `+1.6` net projected delta in Fraktion Mono 22pt, `Theme.accent` fill; caption `NET PROJ. DELTA`

**Source summary strip** (3-column grid inside a single `cardSurface` card, 10pt radius): signals count, sources count, last-synced time. Each cell is 14pt tabular number + 9pt caption.

**Takeaway card** (repeats 3×)

- 0pt-padding card, 16pt radius, border 0.5pt hairline
- Top band: a 52pt-wide color rail (tone fill) containing tag (10pt 800) + position (9pt 700, 80% opacity) stacked; flex-1 body containing player name (15pt 700) + team/pos eyebrow and `projectedDelta` right-aligned (Fraktion Mono 20pt tone)
- Body: 14pt padding — headline (13pt 600), rationale (11pt dim)
- Signal strip (2-column): left = `RANK · 7D` sparkline (110×22pt, filled 12% under line, 1.4pt stroke tone color); right = `CONFIDENCE` dots + descriptor (Low/Med/High/Very high)
- Source chip row
- Footer (grid 1fr 1fr, divider on top and between): `Details` (dim) | `Apply →` (gold, bold)

### Variation C — Narrative Stream

**Voice:** manager at a chalkboard. Paragraph-forward. Player names are inline accents.

**Top**

- Eyebrow `TODAY'S BRIEFING · 9:14 AM` + right-aligned "Fresh" pill (6pt green dot + 10pt label)
- Hero sentence: 19pt 500 weight, -0.3 letter-spacing, 1.4 line-height, body-serif-ish with dashed-underline inline player refs in tone color

**Paragraph block** (repeats 3×)

- 0.5pt top divider, 14pt vertical padding
- Header row: outlined tag pill (1px tone border at 40% opacity, tag text in tone color), position/team eyebrow, right side has confidence dots + `projectedDelta` in tone color
- Body: 13.5pt, 1.55 line-height, cream primary; inline `PlayerRef` spans = 700 weight, tone color, 1px dashed bottom border matching tone
- Source chips footnote row

**Footer actions**

- 2-column grid: `Ask follow-ups` (outlined card) | `Apply all 3 →` (gold fill)
- Sync caption below: `Synthesized from 47 signals · updates Tue Thu Fri Sun` — 10pt, `Theme.textSecondary`, center

---

## Screen 2 — Player Detail Sheet

Presented as a modal sheet (`.sheet` with `.presentationDetents([.large])`) or pushed onto the Intel nav stack.

### Sections top-to-bottom

1. **Grabber + close** (sticky on scroll): standard iOS sheet handle 36×4pt, under-title eyebrow `PLAYER · INTEL` left, `Done` 14pt 600 right
2. **Header**
   - Padding 18/18/16
   - Background `linear-gradient(160deg, tone@12% 0%, bg 70%)`
   - 56×56 team logo plate (12pt radius, bordered, cream-on-team-color)
   - Name 20pt 700; subhead "QB · 49ers · #10 · On **Your Roster**" (12pt dim, roster-state in cream)
   - Two pill badges: AI verdict pill (outlined tone — e.g. `AI SAYS SIT`) + matchup pill (`Week 14 · vs SEA`)
3. **Numerals strip** (4-column grid, 1pt gap on a hairline-backed container, 10pt radius)
   - Cells: `PROJ 11.8 pts` · `RANK QB34 −9` · `OWN% 62 −4` · `START% 18 −22`
   - Caption 9pt 600 letter-spaced; value Fraktion Mono 18pt; delta 10pt (red if `−`, otherwise dim)
4. **AI Summary** (Decision 019-A extension)
   - Eyebrow `AI SUMMARY` with a 14×14 gold star chip before it
   - 14pt body, 1.55 line-height, with inline strong text tinted to `Theme.loss`/`Theme.win`
   - Footer: confidence dots + `Very high confidence · 47 signals` (11pt 600 dim)
5. **Signal Timeline · 72H**
   - Each row: 22pt circular glyph (source-kind icon) in a left rail with a 1pt connector between rows
   - Right column: source name + relative time (tabular-nums); body 12.5pt; tweet-kind rows italic
   - Tone of glyph color encodes sentiment (loss/tie/dim/win)
6. **Week 14 matchup** card: `SF at SEA · Sun 4:25 PM · Lumen` + 3-column mini-grid `SPREAD SEA −3` · `O/U 43.5` · `IMP. TOTAL 20.3`
7. **Sticky action bar** (88pt tall, absolute bottom)
   - 4-column grid with 8pt gaps
   - Primary `Bench` on `Theme.win` fill, `#1A1A1A` text
   - Secondary `Trade`, `Drop`, `Mute` on `cardSurface` with hairline border
   - Each button: 10pt radius, 10pt vertical padding, 14pt stroke icon above 11pt 700 label

### Action handlers

- `Bench` → `APIClient.updateLineup(playerId:slot:.bench)` then dismiss sheet and toast "Mac Jones benched — Week 14"
- `Trade` → push `TradeProposalView(seedPlayerId:)`
- `Drop` → confirmation alert → `APIClient.dropPlayer(playerId:)`
- `Mute` → local `UserDefaults` `mutedPlayerIds` set — suppresses this player from briefings for the current week

---

## Shared components to build

### `SourceChip(kind:, label:)`

Small pill, inline-flex, 2/7pt padding, 999 radius. Background `Color.warmCream.opacity(0.06)`, 0.5pt hairline border. 10pt 600 label, 10×10 stroke glyph prefixed. Glyph color = label color (default dim). One chip per source attribution.

**Icon glyphs** (all 1.4pt stroke, inherit color, drawn from SF Symbols where possible):

- `injury` → `cross.case` or custom plus
- `rank` → `chart.line.uptrend.xyaxis`
- `startsit` → `arrow.up.arrow.down`
- `reddit` → custom smiley
- `twitter` → custom bird or `bubble.left.and.bubble.right`
- `news` → `newspaper`

### `ConfidenceDots(n: Int, max: Int = 4, tone: Color)`

Horizontal group of 5×5pt squircles (3pt radius), 2pt gap. First `n` filled with `tone`, remainder filled with `hairlineStrong`.

### `Sparkline(data: [Int], w, h, color, fill: Bool)`

Lightweight line chart. Already partially present at `Views/Dashboard/SparklineView.swift` — extend to accept `fill: Bool` for a 12% alpha area fill.

### `InlinePlayerRef(name:, tone:)` — for Narrative Stream

Inline text modifier: bold, tone-colored, 1px dashed bottom border in same tone.

---

## Design Tokens (extend `Theme.swift`)

Add these to `Theme`:

```swift
// New elevation surfaces (the current theme only has cardSurface)
static let bgElev1 = Color(hex: 0x1C1A17)  // cards (warmer than current darkSurface)
static let bgElev2 = Color(hex: 0x24211D)  // elevated cards, sheets

// New opacity scale for text + rules
static let textDim    = warmCream.opacity(0.62)   // secondary
static let textFaint  = warmCream.opacity(0.38)   // tertiary / captions
static let hairline         = warmCream.opacity(0.08)
static let hairlineStrong   = warmCream.opacity(0.14)

// Semantic (match audit proposal — current iOS values are fine but consider softening)
// Audit recommends these refined values:
//   win  = 0x6FBF8A (vs current 0x4ADE80 — less neon)
//   loss = 0xD96B6B (vs current 0xF87171 — warmer, aligns with cream)
//   tie  = 0xD6B461 (vs current 0xFBBF24 — distinct from accent gold)
//   info = 0x7FA8C9 (new — for transactions, news-kind signals)

// Monospace display numerals
static let numDisplay = Font.system(size: 32, weight: .semibold, design: .monospaced)
static let numStat    = Font.system(size: 18, weight: .semibold, design: .monospaced)
//   (both should use .monospacedDigit() where SwiftUI allows)
```

**Typography scale** (matches the `T.*` helpers in `tokens.jsx`):

| Role | Font | Size | Weight | Tracking | Color |
|---|---|---|---|---|---|
| `display.num` | mono | 40 | 600 | −0.5 | cream |
| `h1` | SF Display | 22 | 700 | −0.3 | cream |
| `body` | SF Text | 15 | 500 | −0.1 | cream |
| `eyebrow` | SF Text | 11 | 600 | +1.2, caps | gold |
| `label` | SF Text | 12 | 500 | +0.1 | textDim |
| `num.stat` | mono tabular | 18 | 600 | — | tone-dependent |

**Spacing:** existing `Theme.spacingXS/SM/MD/LG/XL` (4/8/16/24/32) cover everything.

**Radii:** existing 8/12/16, plus add `radiusXL = 20` for the editorial lead card.

---

## Data Model additions (`LeagueModels.swift`)

```swift
struct TodaysBriefingResponse: Codable {
    let synthesizedAt: Date
    let signalCount: Int
    let sourceCount: Int
    let takeaways: [BriefingTakeaway]
}

struct BriefingTakeaway: Codable, Identifiable {
    let id: String
    let tag: TakeawayTag          // SIT | ADD | WATCH | START | DROP | TRADE
    let player: FeedPlayer
    let headline: String
    let rationale: String
    let projectedDelta: String?   // nil when TBD
    let confidence: Int           // 0...4
    let sources: [SourceReference]
    let rank7d: [Int]             // ordered oldest→newest
}

enum TakeawayTag: String, Codable {
    case sit = "SIT", add = "ADD", watch = "WATCH", start = "START", drop = "DROP", trade = "TRADE"
    var tone: Color { /* map to Theme.loss/win/tie */ }
}

struct SourceReference: Codable, Hashable {
    let kind: SignalSource   // existing enum — reuse
    let label: String        // "FantasyPros · QB34 (−9)"
}

struct PlayerAISummary: Codable {
    let verdict: TakeawayTag?
    let body: String              // may contain <strong>...</strong> spans
    let confidence: Int
    let signalCount: Int
}
```

## API contract additions

Add to `api/src/routes/intel.ts` (or wherever existing Intel routes live):

```
GET /api/leagues/:leagueId/briefing
  → 200 { synthesizedAt, signalCount, sourceCount, takeaways: [...] }

GET /api/players/:playerId/ai-summary?leagueId=...
  → 200 { verdict, body, confidence, signalCount }
```

Both endpoints should be cacheable for ~5 minutes server-side. The briefing is synthesized by the V2 LLM pipeline; until V2 lands, return a stubbed response that ranks the top 3 signals by `weight` from the existing signal feed.

## Interactions

- **Tap a takeaway headline** → push `PlayerDetailView(playerId:)` onto the Intel nav stack
- **Tap "Apply change" / "Apply →"** on a takeaway → execute the primary action inline:
  - `SIT`/`DROP`/`START` → `APIClient.updateLineup(...)` with optimistic UI, toast on success, revert + error toast on failure
  - `ADD` → push `WaiverClaimView(playerId:)`
  - `WATCH` → add player to watchlist (new `APIClient.addToWatchlist(...)`)
  - `TRADE` → push `TradeProposalView(seedPlayerId:)`
- **Pull-to-refresh** on the Intel list → re-fetch briefing + roster signals
- **Player Detail Sheet dismiss** is swipe-down or Done tap; state (scroll position, etc.) does not need to persist across dismissals
- **Sticky action bar** on the sheet stays visible during scroll; use `.safeAreaInset(edge: .bottom)`

## Accessibility

- All tone colors must pass WCAG AA against `Theme.background` — the softened semantic palette proposed in `Theme.swift` updates above is designed to hit this
- Confidence dots: add `accessibilityLabel("Confidence: Very high, 4 of 4")`
- Signal timeline items: group each row with `accessibilityElement(children: .combine)` and build a combined label: `"From @JeffHowe, 2 hours ago. Shanahan kept Jones on a short leash today."`
- Action bar buttons: `accessibilityTraits` include `.isButton`; Bench as primary action

## Empty + loading + error states

- **Empty briefing** (no signals matched this week, e.g. off-season or brand-new league): show the masthead + a single `cardSurface` card reading "All quiet. No urgent moves for your roster this week." + a secondary `Browse the league feed →` link
- **Loading**: skeleton that mirrors the chosen variation's layout — gray 10pt-radius rectangles at each headline/body/chip position. Reuse `ShimmerView` from `Views/Shared/`
- **Error**: reuse `ErrorStateView(message:onRetry:)`

## Files in this handoff

- `README.md` — this file
- `FantasyHub Audit.html` — full interactive canvas (open in a browser; pan/zoom). Rows 8 and 9 at the bottom are the briefing variations and the player sheet
- `briefing.jsx` — React source for all three briefing variations (reference for layout/spacing/copy)
- `player-sheet.jsx` — React source for the player detail sheet
- `tokens.jsx` — shared design tokens (colors, type scale, primitives) used by the designs
- `after.jsx`, `before.jsx`, `system.jsx` — rest of the audit; useful context but **not in scope** for this handoff

When in doubt about a measurement or color, open `FantasyHub Audit.html` in Chrome, right-click the element, Inspect — every value is in the live DOM.
