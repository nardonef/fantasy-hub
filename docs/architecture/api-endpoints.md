# API Endpoints Reference

Base URL: `http://localhost:3000/api`

All analytics endpoints require authentication (Clerk) and league membership.

## League Management

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/leagues` | List user's leagues with season/manager counts | Built |
| POST | `/leagues/discover` | Discover leagues from a provider | Built |
| POST | `/leagues/connect` | Connect a league and start import | Built |
| GET | `/leagues/:leagueId` | League detail with seasons/managers/members | Built |
| GET | `/leagues/:leagueId/sync-status` | Current import job status | Built |

## Analytics

All scoped to `/leagues/:leagueId/analytics/...`

| Method | Path | Query Params | Description | Status |
|--------|------|-------------|-------------|--------|
| GET | `/standings` | `?year=` | Season standings (W-L-T, PF, PA, rank) | Built |
| GET | `/h2h` | `?year=` | Head-to-head matrix between all managers | Built |
| GET | `/scoring` | `?year=` | Per-manager scoring stats + weekly scores | Built |
| GET | `/draft` | `?year=` | Draft picks with manager/season data | Built |
| GET | `/records` | — | Highest scores, champions, all-time leaders | Built |
| GET | `/extremes` | — | Top/bottom performances, closest games, blowouts | Built |
| GET | `/playoffs` | — | Regular vs playoff PPG, clutch ratings | Built |
| GET | `/distribution` | `?year=` | Score histogram in 10-point buckets | Built |

## Manager

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/leagues/:leagueId/managers/:managerId/profile` | Manager career stats | Built |

## Activity

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/leagues/:leagueId/activity` | Recent activity feed | Built |

## AI Chat

All scoped to `/leagues/:leagueId/chat/...`. Require auth + league membership.

| Method | Path | Body / Query | Description | Status |
|--------|------|-------------|-------------|--------|
| POST | `/chat/threads` | `{ title }` | Create a named thread (max 120 chars) | Built |
| GET | `/chat/threads` | — | List user's threads, ordered by `updatedAt` desc | Built |
| DELETE | `/chat/threads/:threadId` | — | Delete thread + messages (403 if not owner) | Built |
| POST | `/chat/threads/:threadId/messages` | `{ content }` | Send message — returns `text/event-stream` SSE | Built |
| GET | `/chat/threads/:threadId/messages` | `?limit=&before=` | Paginated message history, oldest-first | Built |

### SSE Event Format

The send-message endpoint streams newline-delimited JSON `data:` lines. Each line is a self-contained event distinguished by the `type` field:

```
data: {"type":"tool_call","toolName":"get_standings","status":"running"}
data: {"type":"delta","content":"Ryan Curran led the league"}
data: {"type":"delta","content":" with 1,564 points."}
data: {"type":"done","messageId":"clxyz..."}
data: {"type":"error","error":"OpenAI quota exceeded"}
```

### AI Tools

The send-message pipeline can invoke any of 8 tools against the league's DB. Tool calls and results are persisted as `ChatMessage` rows (role `"assistant"` and `"tool"` respectively) linked by `toolCallId`.

| Tool | Description |
|------|-------------|
| `get_standings` | Season standings, optional `season` filter |
| `get_manager_stats` | W-L-T + scoring stats for one manager |
| `get_matchup_history` | Head-to-head record between two managers |
| `get_draft_results` | All picks for a season, ordered by pick number |
| `get_weekly_scores` | Matchup scores for a season, optional `week` filter |
| `get_league_records` | All-time high scores, champions, win leaders |
| `get_playoff_results` | Regular-season vs playoff PPG, clutch ratings |
| `get_transaction_history` | Adds, drops, trades, waiver moves |

### Chat Message Response

```json
{
  "messages": [
    {
      "id": "cl...",
      "threadId": "cl...",
      "role": "user",
      "content": "Who led the league in scoring in 2024?",
      "toolName": null,
      "toolCallId": null,
      "createdAt": "2026-04-02T00:00:00.000Z"
    },
    {
      "id": "cl...",
      "threadId": "cl...",
      "role": "assistant",
      "content": "",
      "toolName": "get_standings",
      "toolCallId": "call_abc123",
      "createdAt": "2026-04-02T00:00:00.000Z"
    },
    {
      "id": "cl...",
      "threadId": "cl...",
      "role": "tool",
      "content": "[{\"season\":2024,...}]",
      "toolName": "get_standings",
      "toolCallId": "call_abc123",
      "createdAt": "2026-04-02T00:00:00.000Z"
    },
    {
      "id": "cl...",
      "threadId": "cl...",
      "role": "assistant",
      "content": "Ryan Curran led the league with 1,564.88 points in 2024.",
      "toolName": null,
      "toolCallId": null,
      "createdAt": "2026-04-02T00:00:00.000Z"
    }
  ],
  "hasMore": false
}
```

## Response Formats

All responses are JSON with camelCase keys (Prisma default). The iOS client uses `.convertFromSnakeCase` decoder strategy, which passes camelCase keys through unchanged.

### Standings Response
```json
[{
  "id": "string",
  "managerId": "string",
  "manager": { "id": "string", "name": "string", "avatarUrl": "string?" },
  "season": { "year": 2024 },
  "teamName": "string",
  "finalRank": 1,
  "wins": 10, "losses": 4, "ties": 0,
  "pointsFor": 1650.5, "pointsAgainst": 1420.3,
  "madePlayoffs": true
}]
```

### H2H Response
```json
{
  "managers": [{ "id": "string", "name": "string" }],
  "records": [{
    "managerId": "string", "opponentId": "string",
    "wins": 5, "losses": 3, "ties": 0,
    "pointsFor": 800.5, "pointsAgainst": 750.2
  }]
}
```

### Scoring Response
```json
[{
  "managerId": "string", "managerName": "string",
  "gamesPlayed": 14, "totalPoints": 1650.5,
  "avgPoints": 117.9, "maxPoints": 155.2, "minPoints": 80.1,
  "consistency": 15.3,
  "weeklyScores": [{ "year": 2024, "week": 1, "score": 120.5 }]
}]
```

### Extremes Response
```json
{
  "topPerformances": [{ "score": 180.5, "manager": "Name", "opponent": "Name", "opponentScore": 95.2, "week": 5, "year": 2024, "matchupType": "REGULAR" }],
  "bottomPerformances": [...],
  "closestGames": [{ "margin": 0.3, "winnerScore": 100.3, "loserScore": 100.0, "winner": "Name", "loser": "Name", "week": 3, "year": 2024, "matchupType": "REGULAR" }],
  "biggestBlowouts": [...]
}
```
