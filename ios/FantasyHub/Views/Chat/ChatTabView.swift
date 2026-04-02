import SwiftUI

/// Root view for the Chat tab. Lists all connected leagues; tapping one
/// navigates to that league's thread list.
struct ChatTabView: View {
    @EnvironmentObject var leagueStore: LeagueStore

    var body: some View {
        NavigationStack {
            Group {
                if leagueStore.leagues.isEmpty {
                    chatEmptyState
                } else {
                    leagueList
                }
            }
            .background(Theme.background)
            .navigationTitle("AI Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    // MARK: - Subviews

    private var leagueList: some View {
        List(leagueStore.leagues) { league in
            NavigationLink {
                ThreadListView(league: league)
            } label: {
                LeagueRow(league: league)
            }
            .listRowBackground(Theme.card)
            .listRowSeparatorTint(Theme.borderGold)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }

    private var chatEmptyState: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: "bubble.left.and.text.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
            Text("No Leagues Connected")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
            Text("Connect a league to start chatting with your AI assistant.")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.spacingXL)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - League Row

private struct LeagueRow: View {
    let league: League

    var body: some View {
        HStack(spacing: Theme.spacingMD) {
            Image(systemName: league.provider.iconName)
                .font(.system(size: 24))
                .foregroundStyle(Theme.accent)
                .frame(width: 36)

            VStack(alignment: .leading, spacing: Theme.spacingXS) {
                Text(league.name)
                    .font(Theme.titleFont)
                    .foregroundStyle(Theme.textPrimary)
                Text(league.provider.displayName)
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)
            }

            Spacer()
        }
        .padding(.vertical, Theme.spacingSM)
    }
}
