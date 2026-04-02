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
        }
    }

    func setActiveLeague(_ leagueId: String) {
        activeLeagueId = leagueId
    }

    func addLeague(_ league: League) {
        leagues.append(league)
        if activeLeagueId == nil {
            activeLeagueId = league.id
        }
    }
}
