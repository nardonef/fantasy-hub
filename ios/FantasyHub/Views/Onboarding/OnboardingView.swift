import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var step: OnboardingStep = .welcome
    @State private var selectedProvider: Provider?
    @State private var sleeperUsername = ""
    @State private var discoveredLeagues: [ProviderLeague] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var yahooConnected = false

    enum OnboardingStep {
        case welcome
        case selectProvider
        case connectAccount
        case connectYahoo
        case selectLeagues
        case importing
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar: back button + progress dots
                HStack {
                    Button {
                        goBack()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.accent)
                    }
                    .opacity(step != .welcome && step != .importing && step != .connectYahoo ? 1 : 0)
                    .disabled(step == .welcome || step == .importing || step == .connectYahoo)

                    Spacer()

                    HStack(spacing: 8) {
                        ForEach(0..<4) { index in
                            Circle()
                                .fill(index <= stepIndex ? Theme.accent : Theme.card)
                                .frame(width: 8, height: 8)
                        }
                    }

                    Spacer()

                    // Invisible balance element matching back button width
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .semibold))
                        .opacity(0)
                }
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, Theme.spacingMD)

                // Step content fills remaining space
                Group {
                    switch step {
                    case .welcome:
                        WelcomeStep(onContinue: { step = .selectProvider })

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
    }

    private func goBack() {
        switch step {
        case .selectProvider: step = .welcome
        case .connectAccount, .connectYahoo:
            error = nil
            step = .selectProvider
        case .selectLeagues:
            error = nil
            if selectedProvider == .YAHOO {
                step = .connectYahoo
            } else {
                step = .connectAccount
            }
        default: break
        }
    }

    private var stepIndex: Int {
        switch step {
        case .welcome: 0
        case .selectProvider: 1
        case .connectAccount, .connectYahoo: 2
        case .selectLeagues, .importing: 3
        }
    }

    private func handleProviderSelected() {
        guard let provider = selectedProvider else { return }
        switch provider {
        case .YAHOO:
            step = .connectYahoo
            Task { await checkYahooAndDiscover() }
        case .SLEEPER:
            step = .connectAccount
        case .ESPN:
            break
        }
    }

    private func checkYahooAndDiscover() async {
        error = nil
        do {
            let status: YahooConnectionStatus = try await APIClient.shared.getYahooStatus()
            yahooConnected = status.connected
            if status.connected {
                await discoverYahooLeagues()
            }
        } catch {
            yahooConnected = false
        }
    }

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
                // TODO: OAuth flow
                credentials = [:]
            }

            discoveredLeagues = try await APIClient.shared.discoverLeagues(
                provider: provider,
                credentials: credentials
            )
            step = .selectLeagues
        } catch let apiError as APIError {
            switch apiError {
            case .serverMessage(let message) where message.lowercased().contains("not found"):
                self.error = "No Sleeper account found for \"\(sleeperUsername)\". Please check the username and try again."
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

            // Add to store — triggers navigation to main app
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
        } catch {
            self.error = error.localizedDescription
            step = .selectLeagues
        }
    }
}

// MARK: - Onboarding Steps

struct WelcomeStep: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: Theme.spacingLG) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(Theme.accent)

                Text("Fantasy League Hub")
                    .font(Theme.displayFont)
                    .foregroundStyle(Theme.textPrimary)

                Text("Your league's entire history — every season, every matchup, every rivalry — in one place.")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Spacer()

            Button(action: onContinue) {
                Text("Get Started")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.charcoal)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            }
            .padding(.bottom, Theme.spacingXL)
        }
    }
}

struct ProviderSelectionStep: View {
    @Binding var selectedProvider: Provider?
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: Theme.spacingLG) {
                Text("Connect Your League")
                    .font(Theme.headlineFont)
                    .foregroundStyle(Theme.textPrimary)

                Text("Where does your league play?")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)

                VStack(spacing: Theme.spacingSM) {
                    ProviderButton(provider: .SLEEPER, isSelected: selectedProvider == .SLEEPER) {
                        selectedProvider = .SLEEPER
                    }
                    ProviderButton(provider: .YAHOO, isSelected: selectedProvider == .YAHOO) {
                        selectedProvider = .YAHOO
                    }
                    ProviderButton(provider: .ESPN, isSelected: false, isDisabled: true) {}
                }
            }

            Spacer()

            if selectedProvider != nil {
                Button(action: onContinue) {
                    Text("Continue")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.charcoal)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .padding(.bottom, Theme.spacingXL)
            }
        }
    }
}

struct ProviderButton: View {
    let provider: Provider
    let isSelected: Bool
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: provider.iconName)
                    .font(.system(size: 24))
                Text(provider.displayName)
                    .font(Theme.titleFont)
                Spacer()
                if isDisabled {
                    Text("Coming Soon")
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.dimText)
                } else if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.accent)
                }
            }
            .padding(Theme.spacingMD)
            .foregroundStyle(isDisabled ? Theme.dimText : Theme.textPrimary)
            .background(isSelected ? Theme.accent.opacity(0.1) : Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(isSelected ? Theme.accent : .clear, lineWidth: 2)
            )
        }
        .disabled(isDisabled)
    }
}

struct ConnectAccountStep: View {
    let provider: Provider
    @Binding var username: String
    let isLoading: Bool
    let error: String?
    let onConnect: () async -> Void

    private var isButtonDisabled: Bool {
        provider == .SLEEPER && username.isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: Theme.spacingLG) {
                Image(systemName: provider.iconName)
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.accent)

                Text("Connect \(provider.displayName)")
                    .font(Theme.headlineFont)
                    .foregroundStyle(Theme.textPrimary)

                if provider == .SLEEPER {
                    VStack(alignment: .leading, spacing: Theme.spacingSM) {
                        Text("Sleeper Username")
                            .font(Theme.captionFont)
                            .foregroundStyle(Theme.textSecondary)

                        TextField("", text: $username, prompt: Text("Your Sleeper username").foregroundStyle(Theme.dimText))
                            .font(Theme.bodyFont)
                            .foregroundStyle(Theme.textPrimary)
                            .padding(Theme.spacingMD)
                            .background(Theme.card)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    }
                } else if provider == .YAHOO {
                    Text("Sign in with your Yahoo account to import your league history.")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                }

                if let error {
                    Text(error)
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.negative)
                }
            }

            Spacer()

            Button {
                Task { await onConnect() }
            } label: {
                if isLoading {
                    ProgressView()
                        .tint(Theme.charcoal)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                } else {
                    Text("Find My Leagues")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.charcoal)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
            }
            .background(isButtonDisabled ? Theme.dimText : Theme.accent)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .disabled(isButtonDisabled || isLoading)
            .padding(.bottom, Theme.spacingXL)
        }
    }
}

struct SelectLeaguesStep: View {
    let leagues: [ProviderLeague]
    let provider: Provider
    let onConnect: (ProviderLeague) async -> Void

    var body: some View {
        VStack(spacing: Theme.spacingLG) {
            Text("Your Leagues")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)

            Text("Tap a league to import its history")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)

            ScrollView {
                VStack(spacing: Theme.spacingSM) {
                    ForEach(leagues) { league in
                        Button {
                            Task { await onConnect(league) }
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(league.name)
                                        .font(Theme.titleFont)
                                        .foregroundStyle(Theme.textPrimary)
                                    Text("\(league.teamCount) teams · \(league.seasons.count) seasons")
                                        .font(Theme.captionFont)
                                        .foregroundStyle(Theme.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.right.circle")
                                    .foregroundStyle(Theme.accent)
                            }
                            .padding(Theme.spacingMD)
                            .cardStyle()
                        }
                    }
                }
            }
        }
    }
}

// ImportingStep has been replaced by ImportProgressView in ImportProgressView.swift
// SignInView has been moved to SignInView.swift with Clerk SDK integration
