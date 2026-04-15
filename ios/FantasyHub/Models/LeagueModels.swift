import Foundation
import SwiftUI

// MARK: - Core Models

struct League: Identifiable, Codable {
    let id: String
    let name: String
    let provider: Provider
    let scoringType: String?
    let teamCount: Int?
    let seasons: [SeasonSummary]
    let managerCount: Int
}

struct SeasonSummary: Codable {
    let year: Int
    let status: SeasonStatus
}

enum Provider: String, Codable, CaseIterable {
    case YAHOO, ESPN, SLEEPER

    var displayName: String {
        switch self {
        case .YAHOO: "Yahoo"
        case .ESPN: "ESPN"
        case .SLEEPER: "Sleeper"
        }
    }

    var iconName: String {
        switch self {
        case .YAHOO: "y.circle.fill"
        case .ESPN: "e.circle.fill"
        case .SLEEPER: "s.circle.fill"
        }
    }
}

enum SeasonStatus: String, Codable {
    case IMPORTING, IMPORTED, FAILED
}

struct Manager: Identifiable, Codable {
    let id: String
    let name: String
    let avatarUrl: String?
}

// MARK: - Analytics Models

struct StandingsEntry: Identifiable, Codable {
    let id: String
    let managerId: String
    let manager: Manager
    let season: SeasonRef
    let teamName: String
    let finalRank: Int?
    let wins: Int
    let losses: Int
    let ties: Int
    let pointsFor: Double
    let pointsAgainst: Double
    let madePlayoffs: Bool
}

struct SeasonRef: Codable {
    let year: Int
}

struct H2HResponse: Codable {
    let managers: [Manager]
    let records: [H2HRecord]
}

struct H2HRecord: Codable {
    let managerId: String
    let opponentId: String
    let wins: Int
    let losses: Int
    let ties: Int
    let pointsFor: Double
    let pointsAgainst: Double
}

struct ScoringData: Identifiable, Codable {
    var id: String { managerId }
    let managerId: String
    let managerName: String
    let gamesPlayed: Int
    let totalPoints: Double
    let avgPoints: Double
    let maxPoints: Double
    let minPoints: Double
    let consistency: Double
    let weeklyScores: [WeeklyScore]?
}

struct WeeklyScore: Codable {
    let year: Int
    let week: Int
    let score: Double
}

struct SeasonAverage: Identifiable {
    var id: Int { year }
    let year: Int
    let avgPoints: Double
    let gamesPlayed: Int
}

extension ScoringData {
    var seasonAverages: [SeasonAverage] {
        guard let scores = weeklyScores, !scores.isEmpty else { return [] }
        let grouped = Dictionary(grouping: scores) { $0.year }
        return grouped.map { year, weekScores in
            let avg = weekScores.reduce(0.0) { $0 + $1.score } / Double(weekScores.count)
            return SeasonAverage(year: year, avgPoints: avg, gamesPlayed: weekScores.count)
        }
        .sorted { $0.year < $1.year }
    }
}

struct RecordsResponse: Codable {
    let highestScores: [HighScoreRecord]
    let champions: [ChampionRecord]
    let allTimeRecords: [AllTimeRecord]
}

struct HighScoreRecord: Codable {
    let score: Double?
    let manager: String
    let opponent: String
    let opponentScore: Double?
    let week: Int
    let year: Int
}

struct ChampionRecord: Codable {
    let year: Int
    let manager: String
}

struct AllTimeRecord: Codable {
    let manager: Manager?
    let wins: Int
    let losses: Int
    let ties: Int
    let pointsFor: Double
    let pointsAgainst: Double
}

// MARK: - Extremes (Closest Games, Blowouts, Top/Bottom Performances)

struct ExtremesResponse: Codable {
    let topPerformances: [GamePerformance]
    let bottomPerformances: [GamePerformance]
    let closestGames: [GameResult]
    let biggestBlowouts: [GameResult]
}

struct GamePerformance: Identifiable, Codable {
    var id: String { "\(manager)-\(year)-\(week)-\(score)" }
    let score: Double
    let manager: String
    let opponent: String
    let opponentScore: Double
    let week: Int
    let year: Int
    let matchupType: String
}

struct GameResult: Identifiable, Codable {
    var id: String { "\(winner)-\(loser)-\(year)-\(week)" }
    let margin: Double
    let winnerScore: Double
    let loserScore: Double
    let winner: String
    let loser: String
    let week: Int
    let year: Int
    let matchupType: String
}

// MARK: - Playoff Performance

struct PlayoffPerformance: Identifiable, Codable {
    var id: String { managerId }
    let managerId: String
    let managerName: String
    let regularSeasonPPG: Double
    let playoffPPG: Double
    let playoffGames: Int
    let clutchRating: Double
}

// MARK: - Score Distribution

struct DistributionResponse: Codable {
    let totalScores: Int
    let mean: Double
    let median: Double
    let buckets: [DistributionBucket]
}

struct DistributionBucket: Identifiable, Codable {
    var id: String { label }
    let label: String
    let count: Int
}

// MARK: - Draft

struct DraftPickEntry: Identifiable, Codable {
    var id: String { "\(season.year)-\(round)-\(pickNumber)" }
    let managerId: String
    let manager: Manager
    let season: SeasonRef
    let round: Int
    let pickNumber: Int
    let playerName: String
    let position: String?
}

// MARK: - Recent Activity Feed

struct ActivityItem: Identifiable, Codable {
    let id: String
    let type: ActivityType
    let title: String
    let detail: String?
    let timestamp: String
    let managerName: String?
    let iconName: String?
}

struct PaginatedActivityResponse: Codable {
    let items: [ActivityItem]
    let total: Int
    let page: Int
    let hasMore: Bool
}

extension ActivityItem {
    /// Parses the ISO 8601 `timestamp` string and returns a relative time
    /// label such as "2 min ago", "yesterday", or "Mar 15".
    var relativeTimestamp: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: timestamp) else { return timestamp }

        let now = Date()
        let elapsed = now.timeIntervalSince(date)

        // Future dates or just now
        if elapsed < 60 { return "just now" }

        let minutes = Int(elapsed / 60)
        if minutes < 60 { return "\(minutes) min ago" }

        let hours = Int(elapsed / 3600)
        if hours < 24 { return "\(hours)h ago" }

        let calendar = Calendar.current
        if calendar.isDateInYesterday(date) { return "yesterday" }

        let days = Int(elapsed / 86400)
        if days < 7 { return "\(days)d ago" }

        // Older than a week — show "Mar 15" style
        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = calendar.isDate(date, equalTo: now, toGranularity: .year)
            ? "MMM d"
            : "MMM d, yyyy"
        return displayFormatter.string(from: date)
    }
}

enum ActivityType: String, Codable {
    case importComplete = "IMPORT_COMPLETE"
    case recordBroken = "RECORD_BROKEN"
    case seasonImported = "SEASON_IMPORTED"
    case leagueConnected = "LEAGUE_CONNECTED"
    case championCrowned = "CHAMPION_CROWNED"
}


// MARK: - Dashboard / Personal Stats

struct DashboardData: Codable {
    let myManagerId: String
    let allTimeRecord: DashboardRecord
    let championships: Int
    let playoffAppearances: Int
    let rankHistory: [RankHistoryEntry]
    let bestRival: RivalRecord?
    let worstRival: RivalRecord?
    let leagueAvgPpg: Double
    let myAvgPpg: Double
}

struct DashboardRecord: Codable {
    let wins: Int
    let losses: Int
    let ties: Int
}

struct RankHistoryEntry: Identifiable, Codable {
    var id: Int { year }
    let year: Int
    let rank: Int
}

struct RivalRecord: Codable {
    let name: String
    let wins: Int
    let losses: Int
}

// MARK: - Insights

struct InsightsResponse: Codable {
    let insights: [InsightItem]
}

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

// MARK: - Sync Status

struct SyncStatus: Codable {
    let id: String
    let status: String
    let progress: Int
    let totalItems: Int?
    let error: String?
}

// MARK: - AI Chat

/// Nested Prisma _count object for message counts on a thread.
private struct ThreadCount: Codable {
    let messages: Int
}

struct ChatThread: Codable, Identifiable {
    let id: String
    let leagueId: String
    let title: String
    let createdAt: Date
    let updatedAt: Date
    /// Derived from `_count.messages` in the Prisma response.
    let messageCount: Int?

    private enum CodingKeys: String, CodingKey {
        case id, leagueId, title, createdAt, updatedAt
        case countContainer = "_count"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        leagueId = try container.decode(String.self, forKey: .leagueId)
        title = try container.decode(String.self, forKey: .title)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        let count = try container.decodeIfPresent(ThreadCount.self, forKey: .countContainer)
        messageCount = count?.messages
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(leagueId, forKey: .leagueId)
        try container.encode(title, forKey: .title)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        if let messageCount {
            let count = ThreadCount(messages: messageCount)
            try container.encode(count, forKey: .countContainer)
        }
    }
}

struct ChatMessage: Codable, Identifiable {
    let id: String
    let threadId: String
    let role: String   // "user" | "assistant"
    let content: String
    let createdAt: Date
}

struct ChatMessagesResponse: Codable {
    let messages: [ChatMessage]
    let hasMore: Bool
}

struct CreateThreadRequest: Codable {
    let title: String
}

struct SendMessageRequest: Codable {
    let content: String
}

// MARK: - SSE Event Types

/// Parsed SSE events received from the streaming chat endpoints.
enum ChatSSEEvent {
    /// Emitted by the /quick combo endpoint when the thread is created, before deltas.
    case threadCreated(threadId: String, title: String)
    case delta(content: String)
    case toolCall(toolName: String, status: String)
    case done(messageId: String)
    case error(message: String)

    /// Decodes a raw JSON string from an `data: {...}` SSE line.
    static func parse(from jsonString: String) -> ChatSSEEvent? {
        guard let data = jsonString.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = obj["type"] as? String else {
            return nil
        }
        switch type {
        case "thread_created":
            let threadId = obj["threadId"] as? String ?? ""
            let title = obj["title"] as? String ?? ""
            return .threadCreated(threadId: threadId, title: title)
        case "delta":
            let content = obj["content"] as? String ?? ""
            return .delta(content: content)
        case "tool_call":
            let toolName = obj["toolName"] as? String ?? ""
            let status = obj["status"] as? String ?? ""
            return .toolCall(toolName: toolName, status: status)
        case "done":
            let messageId = obj["messageId"] as? String ?? ""
            return .done(messageId: messageId)
        case "error":
            let message = obj["error"] as? String ?? "Unknown error"
            return .error(message: message)
        default:
            return nil
        }
    }
}

// MARK: - Intelligence Layer / Feed Models

enum SignalSource: String, Codable, CaseIterable {
    case reddit = "REDDIT"
    case bluesky = "BLUESKY"
    case sportsdata = "SPORTSDATA"
    case fantasypros = "FANTASYPROS"

    var displayName: String {
        switch self {
        case .reddit: "Reddit"
        case .bluesky: "Bluesky"
        case .sportsdata: "SportsData"
        case .fantasypros: "FantasyPros"
        }
    }

    var accentColor: Color {
        switch self {
        case .reddit: Color(hex: 0xFF4500)
        case .bluesky: Color(hex: 0x0085FF)
        case .sportsdata: Color(hex: 0x9B59B6)
        case .fantasypros: Color(hex: 0x4ADE80)
        }
    }
}

enum SignalType: String, Codable {
    case rankingChange = "RANKING_CHANGE"
    case socialMention = "SOCIAL_MENTION"
    case statsUpdate = "STATS_UPDATE"
    case recommendation = "RECOMMENDATION"

    var displayName: String {
        switch self {
        case .rankingChange: "Rankings"
        case .socialMention: "Social"
        case .statsUpdate: "Stats"
        case .recommendation: "Pick"
        }
    }

    var systemIcon: String {
        switch self {
        case .rankingChange: "arrow.up.arrow.down"
        case .socialMention: "bubble.left"
        case .statsUpdate: "chart.bar.fill"
        case .recommendation: "star.fill"
        }
    }
}

struct FeedPlayer: Identifiable, Codable {
    let id: String
    let fullName: String
    let position: String?
    let nflTeam: String?

    var positionColor: Color {
        switch position?.uppercased() {
        case "QB": return Color(hex: 0xF87171)
        case "RB": return Color(hex: 0x67E8F9)
        case "WR": return Color(hex: 0xC9A96E)
        case "TE": return Color(hex: 0x4ADE80)
        case "K":  return Color(hex: 0xC084FC)
        case "DEF": return Color(hex: 0xFB923C)
        default:   return Color(hex: 0x8A8578)
        }
    }
}

struct Signal: Identifiable, Codable {
    let id: String
    let playerId: String
    let source: SignalSource
    let signalType: SignalType
    let content: String
    let publishedAt: Date
    let fetchedAt: Date
    let player: FeedPlayer

    var relativeTime: String {
        let diff = Date().timeIntervalSince(fetchedAt)
        switch diff {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(diff / 60))m ago"
        case ..<86400: return "\(Int(diff / 3600))h ago"
        default: return "\(Int(diff / 86400))d ago"
        }
    }
}

struct FeedResponse: Codable {
    let signals: [Signal]
    let nextCursor: String?
}

struct LatestSignal: Codable {
    let id: String
    let signalType: SignalType
    let content: String
    let publishedAt: Date
    let fetchedAt: Date
}

struct RecommendationItem: Identifiable, Codable {
    var id: String { player.id }
    let player: FeedPlayer
    let signalCount: Int
    let confidence: Int
    let sources: [String]
    let latestSignal: LatestSignal
}

struct RecommendationsResponse: Codable {
    let recommendations: [RecommendationItem]
    let since: String
}

struct PlayerSignal: Identifiable, Codable {
    let id: String
    let source: SignalSource
    let signalType: SignalType
    let content: String
    let publishedAt: Date
    let fetchedAt: Date

    var relativeTime: String {
        let diff = Date().timeIntervalSince(fetchedAt)
        switch diff {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(diff / 60))m ago"
        case ..<86400: return "\(Int(diff / 3600))h ago"
        default: return "\(Int(diff / 86400))d ago"
        }
    }
}

struct PlayerDetail: Identifiable, Codable {
    let id: String
    let fullName: String
    let position: String?
    let nflTeam: String?
    let status: String?
    let signals: [PlayerSignal]

    var positionColor: Color {
        switch position?.uppercased() {
        case "QB": return Color(hex: 0xF87171)
        case "RB": return Color(hex: 0x67E8F9)
        case "WR": return Color(hex: 0xC9A96E)
        case "TE": return Color(hex: 0x4ADE80)
        case "K":  return Color(hex: 0xC084FC)
        case "DEF": return Color(hex: 0xFB923C)
        default:   return Color(hex: 0x8A8578)
        }
    }
}

struct PlayerDetailResponse: Codable {
    let player: PlayerDetail
}

struct PlayerSearchResult: Identifiable, Codable {
    let id: String
    let fullName: String
    let position: String?
    let nflTeam: String?
    let status: String?
}

struct PlayerSearchResponse: Codable {
    let players: [PlayerSearchResult]
}
