import SwiftUI

/// Central store for league data and active league selection
@MainActor
class LeagueStore: ObservableObject {
    @Published var leagues: [League] = []
    @Published var activeLeagueId: String? {
        didSet { UserDefaults.standard.set(activeLeagueId, forKey: "activeLeagueId") }
    }
    @Published var isLoading = false
    @Published var hasAttemptedLoad = false
    @Published var error: String?

    // Feed prefetch — populated in the background after leagues load so Intel tab
    // has data ready before the user navigates there.
    @Published var prefetchedFeedSignals: [Signal] = []
    @Published var prefetchedFeedCursor: String? = nil
    @Published var prefetchedFeedManager: Manager? = nil

    var hasLeagues: Bool { !leagues.isEmpty }

    var activeLeague: League? {
        leagues.first { $0.id == activeLeagueId } ?? leagues.first
    }

    init() {
        activeLeagueId = UserDefaults.standard.string(forKey: "activeLeagueId")
    }

    func loadLeagues() async {
        isLoading = true
        error = nil
        defer {
            isLoading = false
            hasAttemptedLoad = true
        }

        do {
            leagues = try await APIClient.shared.getLeagues()
            if activeLeagueId == nil {
                activeLeagueId = leagues.first?.id
            }
        } catch {
            self.error = error.localizedDescription
            return
        }

        // Prefetch Intel feed in the background so it's ready on first navigation
        if let leagueId = activeLeague?.id {
            Task { await prefetchFeed(leagueId: leagueId) }
        }
    }

    func prefetchFeed(leagueId: String) async {
        guard let manager = try? await APIClient.shared.getMyManager(leagueId: leagueId) else { return }
        try? await APIClient.shared.refreshRoster(leagueId: leagueId)
        guard let response = try? await APIClient.shared.getFeed(leagueId: leagueId, myRosterOnly: true) else { return }
        prefetchedFeedManager = manager
        prefetchedFeedSignals = response.signals
        prefetchedFeedCursor = response.nextCursor
    }

    func consumePrefetchedFeed() -> (manager: Manager?, signals: [Signal], cursor: String?)? {
        guard !prefetchedFeedSignals.isEmpty || prefetchedFeedManager != nil else { return nil }
        let result = (prefetchedFeedManager, prefetchedFeedSignals, prefetchedFeedCursor)
        prefetchedFeedManager = nil
        prefetchedFeedSignals = []
        prefetchedFeedCursor = nil
        return result
    }

    func setActiveLeague(_ leagueId: String) {
        activeLeagueId = leagueId
        prefetchedFeedManager = nil
        prefetchedFeedSignals = []
        prefetchedFeedCursor = nil
        Task { await prefetchFeed(leagueId: leagueId) }
    }

    func addLeague(_ league: League) {
        leagues.append(league)
        if activeLeagueId == nil {
            activeLeagueId = league.id
        }
    }
}
