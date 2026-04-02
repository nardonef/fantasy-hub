import SwiftUI

struct AddLeagueSheet: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var leagueStore: LeagueStore
    @Environment(\.dismiss) private var dismiss
    @State private var step: Step = .selectProvider
    @State private var selectedProvider: Provider?
    @State private var sleeperUsername = ""
    @State private var discoveredLeagues: [ProviderLeague] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var yahooConnected = false

    enum Step {
        case selectProvider
        case connectAccount    // Sleeper username entry
        case connectYahoo      // Yahoo OAuth flow
        case selectLeagues
        case importing
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    Group {
                        switch step {
                        case .selectProvider:
                            ProviderSelectionStep(
                                selectedProvider: $selectedProvider,
                                onContinue: { handleProviderSelected() }
                            )

                        case .connectAccount:
                            ConnectAccountStep(
                                provider: selectedProvider ?? .SLEEPER,
                                username: $sleeperUsername,
                                isLoading: isLoading,
                                error: error,
                                onConnect: connectAccount
                            )

                        case .connectYahoo:
                            YahooConnectStep(
                                userId: authManager.userId,
                                isConnected: yahooConnected,
                                isLoading: isLoading,
                                error: error,
                                onCheckStatus: checkYahooAndDiscover,
                                onDiscover: discoverYahooLeagues
                            )

                        case .selectLeagues:
                            SelectLeaguesStep(
                                leagues: discoveredLeagues,
                                provider: selectedProvider ?? .SLEEPER,
                                onConnect: connectLeague
                            )

                        case .importing:
                            ImportProgressView()
                        }
                    }
                    .frame(maxHeight: .infinity)
                    .padding(.horizontal, Theme.spacingMD)
                }
            }
            .navigationTitle("Add League")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
    }

    private func handleProviderSelected() {
        guard let provider = selectedProvider else { return }
        switch provider {
        case .YAHOO:
            step = .connectYahoo
            // Kick off a status check immediately
            Task { await checkYahooAndDiscover() }
        case .SLEEPER:
            step = .connectAccount
        case .ESPN:
            break
        }
    }

    /// Check Yahoo connection status. If already connected, auto-discover leagues.
    private func checkYahooAndDiscover() async {
        error = nil
        do {
            let status: YahooConnectionStatus = try await APIClient.shared.getYahooStatus()
            yahooConnected = status.connected
            if status.connected {
                await discoverYahooLeagues()
            }
        } catch {
            // Not connected — user needs to do OAuth
            yahooConnected = false
        }
    }

    /// Discover Yahoo leagues (called after OAuth completes or if already connected)
    private func discoverYahooLeagues() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            discoveredLeagues = try await APIClient.shared.discoverLeagues(
                provider: .YAHOO,
                credentials: [:]
            )
            step = .selectLeagues
        } catch let apiError as APIError {
            switch apiError {
            case .serverMessage(let message):
                self.error = message
            default:
                self.error = "Something went wrong fetching your Yahoo leagues. Please try again."
            }
        } catch {
            self.error = "Something went wrong. Please check your connection and try again."
        }
    }

    private func connectAccount() async {
        guard let provider = selectedProvider else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let credentials: [String: String]
            switch provider {
            case .SLEEPER:
                credentials = ["username": sleeperUsername]
            case .YAHOO, .ESPN:
                credentials = [:]
            }

            discoveredLeagues = try await APIClient.shared.discoverLeagues(
                provider: provider,
                credentials: credentials
            )
            step = .selectLeagues
        } catch let apiError as APIError {
            switch apiError {
            case .serverMessage(let message):
                self.error = message
            default:
                self.error = "Something went wrong connecting to \(provider.displayName). Please try again."
            }
        } catch {
            self.error = "Something went wrong. Please check your connection and try again."
        }
    }

    private func connectLeague(_ league: ProviderLeague) async {
        guard let provider = selectedProvider else { return }
        step = .importing

        do {
            let credentials: [String: String]
            switch provider {
            case .SLEEPER: credentials = ["username": sleeperUsername]
            case .YAHOO, .ESPN: credentials = [:]
            }

            let response = try await APIClient.shared.connectLeague(
                provider: provider,
                providerLeagueId: league.providerLeagueId,
                name: league.name,
                scoringType: league.scoringType,
                teamCount: league.teamCount,
                credentials: credentials,
                years: league.seasons,
                seasonLeagueIds: league.seasonLeagueIds
            )

            let newLeague = League(
                id: response.league.id,
                name: response.league.name,
                provider: provider,
                scoringType: league.scoringType,
                teamCount: league.teamCount,
                seasons: league.seasons.map { SeasonSummary(year: $0, status: .IMPORTING) },
                managerCount: league.teamCount
            )
            leagueStore.addLeague(newLeague)
            dismiss()
        } catch {
            self.error = error.localizedDescription
            step = .selectLeagues
        }
    }
}

// MARK: - Yahoo Connect Step

/// Inline Yahoo OAuth flow for Add League.
/// If already connected → auto-discovers leagues.
/// If not → prompts user to sign in via Safari, then checks status.
struct YahooConnectStep: View {
    let userId: String?
    let isConnected: Bool
    let isLoading: Bool
    let error: String?
    let onCheckStatus: () async -> Void
    let onDiscover: () async -> Void

    @State private var waitingForBrowser = false

    private var authURL: URL? {
        var components = URLComponents(string: "https://localhost:3443/api/auth/yahoo")
        if let userId {
            components?.queryItems = [URLQueryItem(name: "userId", value: userId)]
        }
        return components?.url
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: Theme.spacingLG) {
                Image(systemName: "y.circle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.accent)

                if isLoading {
                    VStack(spacing: Theme.spacingSM) {
                        ProgressView()
                            .tint(Theme.accent)
                        Text(waitingForBrowser ? "Finding your leagues..." : "Checking Yahoo connection...")
                            .font(Theme.bodyFont)
                            .foregroundStyle(Theme.textSecondary)
                    }
                } else if waitingForBrowser {
                    VStack(spacing: Theme.spacingSM) {
                        Text("Complete Sign-In")
                            .font(Theme.headlineFont)
                            .foregroundStyle(Theme.textPrimary)

                        Text("Complete the sign-in in your browser, then tap the button below.")
                            .font(Theme.bodyFont)
                            .foregroundStyle(Theme.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                } else {
                    VStack(spacing: Theme.spacingSM) {
                        Text("Connect Yahoo")
                            .font(Theme.headlineFont)
                            .foregroundStyle(Theme.textPrimary)

                        Text("Sign in with your Yahoo account to import your league history.")
                            .font(Theme.bodyFont)
                            .foregroundStyle(Theme.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                }

                if let error {
                    Text(error)
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.loss)
                        .multilineTextAlignment(.center)
                }
            }

            Spacer()

            if !isLoading {
                VStack(spacing: Theme.spacingSM) {
                    if waitingForBrowser {
                        Button {
                            Task { await onCheckStatus() }
                        } label: {
                            Text("I've Signed In")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(Theme.charcoal)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                        }
                        .background(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

                        Button {
                            openYahooAuth()
                        } label: {
                            Text("Reopen Browser")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Theme.accent)
                        }
                    } else {
                        Button {
                            openYahooAuth()
                        } label: {
                            Text("Sign in with Yahoo")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(Theme.charcoal)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                        }
                        .background(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    }
                }
                .padding(.bottom, Theme.spacingXL)
            }
        }
    }

    private func openYahooAuth() {
        guard let authURL else { return }
        UIApplication.shared.open(authURL) { opened in
            Task { @MainActor in
                if opened {
                    waitingForBrowser = true
                }
            }
        }
    }
}
