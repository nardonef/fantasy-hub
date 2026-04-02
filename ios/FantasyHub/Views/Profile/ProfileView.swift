import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var yahooConnected = false
    @State private var showingAddLeague = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Theme.spacingLG) {
                    // Avatar + Name
                    VStack(spacing: Theme.spacingSM) {
                        Circle()
                            .fill(Theme.accent.opacity(0.2))
                            .frame(width: 80, height: 80)
                            .overlay {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 32))
                                    .foregroundStyle(Theme.accent)
                            }

                        Text(authManager.displayName)
                            .font(Theme.titleFont)
                            .foregroundStyle(Theme.textPrimary)

                        Text("Member since 2026")
                            .font(Theme.captionFont)
                            .foregroundStyle(Theme.dimText)
                    }
                    .padding(.top, Theme.spacingMD)

                    // Connected Accounts
                    VStack(alignment: .leading, spacing: 0) {
                        Text("CONNECTED ACCOUNTS")
                            .sectionHeaderStyle()
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.bottom, Theme.spacingSM)

                        VStack(spacing: 0) {
                            ConnectedAccountRow(
                                provider: .SLEEPER,
                                status: "Connected"
                            )
                            Divider().background(Theme.surface)
                            ConnectedAccountRow(
                                provider: .YAHOO,
                                status: yahooConnected ? "Connected" : "Not connected"
                            )
                            Divider().background(Theme.surface)
                            ConnectedAccountRow(
                                provider: .ESPN,
                                status: "Coming in V2"
                            )
                        }
                        .cardStyle()
                    }

                    // My Leagues
                    VStack(alignment: .leading, spacing: 0) {
                        Text("MY LEAGUES")
                            .sectionHeaderStyle()
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.bottom, Theme.spacingSM)

                        VStack(spacing: 0) {
                            if leagueStore.leagues.isEmpty {
                                EmptyStateView(
                                    icon: "sportscourt",
                                    title: "No Leagues",
                                    message: "Connect a provider to import your leagues."
                                )
                            } else {
                                ForEach(leagueStore.leagues) { league in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(league.name)
                                                .font(Theme.bodyFont)
                                                .foregroundStyle(Theme.textPrimary)
                                            Text("\(league.provider.displayName) · \(league.seasons.count) seasons")
                                                .font(.system(size: 11))
                                                .foregroundStyle(Theme.dimText)
                                        }
                                        Spacer()
                                        if leagueStore.activeLeagueId == league.id {
                                            Text("ACTIVE")
                                                .font(.system(size: 9, weight: .bold))
                                                .foregroundStyle(Theme.accent)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 3)
                                                .background(Theme.accent.opacity(0.15))
                                                .clipShape(Capsule())
                                        }
                                    }
                                    .padding(Theme.spacingMD)

                                    if league.id != leagueStore.leagues.last?.id {
                                        Divider().background(Theme.surface)
                                    }
                                }
                            }
                        }
                        .cardStyle()

                        Button {
                            showingAddLeague = true
                        } label: {
                            HStack {
                                Image(systemName: "plus.circle")
                                    .font(.system(size: 16))
                                Text("Add League")
                                    .font(.system(size: 14, weight: .medium))
                            }
                            .foregroundStyle(Theme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.card)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                        }
                        .padding(.top, Theme.spacingSM)
                    }

                    // Settings
                    VStack(alignment: .leading, spacing: 0) {
                        Text("SETTINGS")
                            .sectionHeaderStyle()
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.bottom, Theme.spacingSM)

                        VStack(spacing: 0) {
                            SettingsRow(icon: "bell", iconColor: Theme.accent, title: "Notifications", detail: "Off")
                            Divider().background(Theme.surface)
                            SettingsRow(icon: "paintbrush", iconColor: Theme.accentMuted, title: "Appearance", detail: "Dark")
                            Divider().background(Theme.surface)
                            SettingsRow(icon: "questionmark.circle", iconColor: Theme.accent, title: "Help & Support")
                            Divider().background(Theme.surface)
                            SettingsRow(icon: "doc.text", iconColor: Theme.dimText, title: "Privacy Policy")
                        }
                        .cardStyle()
                    }

                    // App Info + Sign Out
                    VStack(spacing: Theme.spacingSM) {
                        Text("Fantasy League Hub v0.1.0")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.dimText)

                        Button {
                            Task { await authManager.signOut() }
                        } label: {
                            Text("Sign Out")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.loss)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Theme.loss.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                        }
                    }
                    .padding(.top, Theme.spacingSM)
                }
                .padding(.horizontal, Theme.spacingMD)
                .padding(.bottom, 160)
            }
            .background(Theme.background)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .fullScreenCover(isPresented: $showingAddLeague, onDismiss: { Task { await checkYahooStatus() } }) {
                AddLeagueSheet()
                    .environmentObject(authManager)
                    .environmentObject(leagueStore)
            }
            .task { await checkYahooStatus() }
        }
    }

    private func checkYahooStatus() async {
        do {
            let status: YahooConnectionStatus = try await APIClient.shared.getYahooStatus()
            yahooConnected = status.connected
        } catch {
            // Leave as-is if check fails
        }
    }
}

struct ConnectedAccountRow: View {
    let provider: Provider
    let status: String

    private var isConnected: Bool { status == "Connected" }

    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: provider.iconName)
                .font(.system(size: 20))
                .foregroundStyle(isConnected ? Theme.accent : Theme.dimText)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(provider.displayName)
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textPrimary)
                Text(status)
                    .font(.system(size: 11))
                    .foregroundStyle(isConnected ? Theme.win : Theme.dimText)
            }

            Spacer()
        }
        .padding(Theme.spacingMD)
    }
}

