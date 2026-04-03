import Foundation
import ClerkKit

/// Central API client for Fantasy Hub backend
actor APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession

    /// Stream for notifying AuthManager that the session is irrecoverably expired.
    private let sessionExpiredContinuation: AsyncStream<Void>.Continuation
    let onSessionExpired: AsyncStream<Void>

    /// Coalesces concurrent token refresh attempts into one.
    private var activeRefreshTask: Task<String?, Never>?

    private init() {
        // TODO: Configure from environment/build settings
        self.baseURL = URL(string: "http://localhost:3000/api")!
        self.session = URLSession.shared
        let (stream, continuation) = AsyncStream.makeStream(of: Void.self)
        self.onSessionExpired = stream
        self.sessionExpiredContinuation = continuation
    }

    /// Get the current Clerk session token for authenticated requests
    private func getAuthToken() async -> String? {
        return try? await Clerk.shared.auth.getToken()
    }

    /// Refreshes the auth token, coalescing concurrent calls into a single Clerk request.
    private func refreshToken() async -> String? {
        if let existing = activeRefreshTask {
            return await existing.value
        }
        let task = Task<String?, Never> {
            try? await Clerk.shared.auth.getToken()
        }
        activeRefreshTask = task
        let result = await task.value
        activeRefreshTask = nil
        return result
    }

    // MARK: - League Endpoints

    func getLeagues() async throws -> [League] {
        try await request(.get, path: "/leagues")
    }

    func discoverLeagues(provider: Provider, credentials: [String: String]) async throws -> [ProviderLeague] {
        try await request(.post, path: "/leagues/discover", body: [
            "provider": provider.rawValue,
            "credentials": credentials,
        ] as [String: Any])
    }

    func connectLeague(
        provider: Provider,
        providerLeagueId: String,
        name: String,
        scoringType: String?,
        teamCount: Int?,
        credentials: [String: String],
        years: [Int],
        seasonLeagueIds: [String: String]? = nil
    ) async throws -> ConnectLeagueResponse {
        var body: [String: Any] = [
            "provider": provider.rawValue,
            "providerLeagueId": providerLeagueId,
            "name": name,
            "scoringType": scoringType as Any,
            "teamCount": teamCount as Any,
            "credentials": credentials,
            "years": years,
        ]
        if let seasonLeagueIds {
            body["seasonLeagueIds"] = seasonLeagueIds
        }
        return try await request(.post, path: "/leagues/connect", body: body)
    }

    func getSyncStatus(leagueId: String) async throws -> SyncStatus? {
        try await request(.get, path: "/leagues/\(leagueId)/sync-status")
    }

    // MARK: - Invite Endpoints

    func generateInviteLink(leagueId: String) async throws -> InviteResponse {
        try await request(.post, path: "/leagues/\(leagueId)/invite")
    }

    func previewInvite(code: String) async throws -> InvitePreview {
        try await request(.get, path: "/leagues/invite/\(code)")
    }

    func joinLeague(inviteCode: String) async throws -> JoinLeagueResponse {
        try await request(.post, path: "/leagues/join/\(inviteCode)")
    }

    // MARK: - Analytics Endpoints

    func getStandings(leagueId: String, year: Int? = nil) async throws -> [StandingsEntry] {
        var path = "/leagues/\(leagueId)/analytics/standings"
        if let year { path += "?year=\(year)" }
        return try await request(.get, path: path)
    }

    func getH2H(leagueId: String, year: Int? = nil) async throws -> H2HResponse {
        var path = "/leagues/\(leagueId)/analytics/h2h"
        if let year { path += "?year=\(year)" }
        return try await request(.get, path: path)
    }

    func getScoring(leagueId: String, year: Int? = nil, includeWeekly: Bool = false) async throws -> [ScoringData] {
        var path = "/leagues/\(leagueId)/analytics/scoring"
        var params: [String] = []
        if let year { params.append("year=\(year)") }
        if includeWeekly { params.append("includeWeekly=true") }
        if !params.isEmpty { path += "?" + params.joined(separator: "&") }
        return try await request(.get, path: path)
    }

    func getRecords(leagueId: String) async throws -> RecordsResponse {
        try await request(.get, path: "/leagues/\(leagueId)/analytics/records")
    }

    func getDraftPicks(leagueId: String, year: Int? = nil) async throws -> [DraftPickEntry] {
        var path = "/leagues/\(leagueId)/analytics/draft"
        if let year { path += "?year=\(year)" }
        return try await request(.get, path: path)
    }

    func getExtremes(leagueId: String, limit: Int? = nil) async throws -> ExtremesResponse {
        var path = "/leagues/\(leagueId)/analytics/extremes"
        if let limit { path += "?limit=\(limit)" }
        return try await request(.get, path: path)
    }

    func getPlayoffs(leagueId: String) async throws -> [PlayoffPerformance] {
        try await request(.get, path: "/leagues/\(leagueId)/analytics/playoffs")
    }

    func getDistribution(leagueId: String, year: Int? = nil) async throws -> DistributionResponse {
        var path = "/leagues/\(leagueId)/analytics/distribution"
        if let year { path += "?year=\(year)" }
        return try await request(.get, path: path)
    }

    func getManagerProfile(leagueId: String, managerId: String) async throws -> ManagerProfile {
        try await request(.get, path: "/leagues/\(leagueId)/managers/\(managerId)/profile")
    }

    func claimManager(leagueId: String, managerId: String) async throws -> Manager {
        try await request(.put, path: "/leagues/\(leagueId)/managers/\(managerId)/claim")
    }

    func getMyManager(leagueId: String) async throws -> Manager? {
        try await request(.get, path: "/leagues/\(leagueId)/my-manager")
    }

    func getDashboard(leagueId: String) async throws -> DashboardData? {
        try await request(.get, path: "/leagues/\(leagueId)/analytics/dashboard")
    }

    func getInsights(leagueId: String) async throws -> [InsightItem] {
        let response: InsightsResponse = try await request(.get, path: "/leagues/\(leagueId)/analytics/insights")
        return response.insights
    }

    func getRecentActivity(leagueId: String) async throws -> [ActivityItem] {
        try await request(.get, path: "/leagues/\(leagueId)/activity")
    }

    func getRecentActivity(leagueId: String, page: Int, limit: Int = 20) async throws -> PaginatedActivityResponse {
        try await request(.get, path: "/leagues/\(leagueId)/activity?page=\(page)&limit=\(limit)")
    }

    // MARK: - Chat Endpoints

    func createThread(leagueId: String, title: String) async throws -> ChatThread {
        let body: [String: Any] = ["title": title]
        return try await request(.post, path: "/leagues/\(leagueId)/chat/threads", body: body)
    }

    func getThreads(leagueId: String) async throws -> [ChatThread] {
        try await request(.get, path: "/leagues/\(leagueId)/chat/threads")
    }

    func deleteThread(leagueId: String, threadId: String) async throws {
        try await requestNoContent(.delete, path: "/leagues/\(leagueId)/chat/threads/\(threadId)")
    }

    func getMessages(leagueId: String, threadId: String) async throws -> [ChatMessage] {
        let response: ChatMessagesResponse = try await request(
            .get,
            path: "/leagues/\(leagueId)/chat/threads/\(threadId)/messages"
        )
        return response.messages
    }

    /// Builds an authenticated URLRequest for the SSE streaming send-message endpoint.
    /// The caller is responsible for opening the URLSession byte stream directly.
    func sendMessageRequest(leagueId: String, threadId: String, content: String) async throws -> URLRequest {
        guard let url = URL(string: baseURL.absoluteString + "/leagues/\(leagueId)/chat/threads/\(threadId)/messages") else {
            throw APIError.invalidResponse
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        if let token = await getAuthToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let body = SendMessageRequest(content: content)
        req.httpBody = try JSONEncoder().encode(body)
        return req
    }

    // MARK: - Auth Endpoints

    func getYahooStatus() async throws -> YahooConnectionStatus {
        try await request(.get, path: "/auth/yahoo/status")
    }

    // MARK: - Network Layer

    private enum HTTPMethod: String {
        case get = "GET"
        case post = "POST"
        case put = "PUT"
        case delete = "DELETE"
    }

    private func request<T: Decodable>(
        _ method: HTTPMethod,
        path: String,
        body: [String: Any]? = nil
    ) async throws -> T {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }

        func buildRequest(token: String?) throws -> URLRequest {
            var req = URLRequest(url: url)
            req.httpMethod = method.rawValue
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let token {
                req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            if let body {
                req.httpBody = try JSONSerialization.data(withJSONObject: body)
            }
            return req
        }

        // First attempt
        let token = await getAuthToken()
        let (data, response) = try await session.data(for: buildRequest(token: token))

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        // If 401, attempt one retry with a refreshed token
        if httpResponse.statusCode == 401 {
            guard let freshToken = await refreshToken() else {
                sessionExpiredContinuation.yield(())
                throw APIError.sessionExpired
            }

            let (retryData, retryResponse) = try await session.data(for: buildRequest(token: freshToken))
            guard let retryHttp = retryResponse as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if retryHttp.statusCode == 401 {
                sessionExpiredContinuation.yield(())
                throw APIError.sessionExpired
            }

            return try decodeResponse(data: retryData, httpResponse: retryHttp)
        }

        return try decodeResponse(data: data, httpResponse: httpResponse)
    }

    /// Executes a request that returns no body (e.g., 204 No Content on DELETE).
    private func requestNoContent(_ method: HTTPMethod, path: String) async throws {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw APIError.invalidResponse
        }

        func buildRequest(token: String?) -> URLRequest {
            var req = URLRequest(url: url)
            req.httpMethod = method.rawValue
            if let token {
                req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            return req
        }

        let token = await getAuthToken()
        let (_, response) = try await session.data(for: buildRequest(token: token))

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            guard let freshToken = await refreshToken() else {
                sessionExpiredContinuation.yield(())
                throw APIError.sessionExpired
            }
            let (_, retryResponse) = try await session.data(for: buildRequest(token: freshToken))
            guard let retryHttp = retryResponse as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            if retryHttp.statusCode == 401 {
                sessionExpiredContinuation.yield(())
                throw APIError.sessionExpired
            }
            guard (200...299).contains(retryHttp.statusCode) else {
                throw APIError.httpError(statusCode: retryHttp.statusCode)
            }
            return
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
    }

    private func decodeResponse<T: Decodable>(data: Data, httpResponse: HTTPURLResponse) throws -> T {
        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorBody = try? JSONDecoder().decode(ServerErrorResponse.self, from: data),
               !errorBody.error.isEmpty {
                throw APIError.serverMessage(errorBody.error)
            }
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }
}

private struct ServerErrorResponse: Decodable {
    let error: String
}

enum APIError: LocalizedError {
    case invalidResponse
    case httpError(statusCode: Int)
    case serverMessage(String)
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Invalid server response"
        case .httpError(let code): "Server error (HTTP \(code))"
        case .serverMessage(let message): message
        case .sessionExpired: "Your session has expired. Please sign in again."
        }
    }

    var isAuthError: Bool {
        switch self {
        case .sessionExpired: true
        case .httpError(let code): code == 401
        default: false
        }
    }
}

struct ProviderLeague: Identifiable, Codable {
    var id: String { providerLeagueId }
    let providerLeagueId: String
    let name: String
    let scoringType: String?
    let teamCount: Int
    let seasons: [Int]
    /// Yahoo-specific: maps year → league_key since each season has a different key
    let seasonLeagueIds: [String: String]?
}

struct ConnectLeagueResponse: Codable {
    let league: ConnectedLeague
    let syncJobId: String
}

struct ConnectedLeague: Codable {
    let id: String
    let name: String
    let provider: String
}

struct YahooConnectionStatus: Codable {
    let connected: Bool
    let providerUserId: String?
    let tokenExpired: Bool?
}
