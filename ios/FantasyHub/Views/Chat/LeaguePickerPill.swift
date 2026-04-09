import SwiftUI

/// Compact league selector shown in the chat navigation bar.
/// Hidden when the user has only one league (auto-selected).
struct LeaguePickerPill: View {
    @EnvironmentObject var leagueStore: LeagueStore

    var body: some View {
        if leagueStore.leagues.count > 1, let active = leagueStore.activeLeague {
            Menu {
                ForEach(leagueStore.leagues) { league in
                    Button {
                        leagueStore.setActiveLeague(league.id)
                    } label: {
                        Label(league.name, systemImage: selectedIcon(for: league, active: active))
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(active.name)
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textPrimary)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, Theme.spacingSM)
                .padding(.vertical, 5)
                .background(Theme.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Theme.borderGold, lineWidth: 1))
            }
        }
    }

    private func selectedIcon(for league: League, active: League) -> String {
        league.id == active.id ? "checkmark" : league.provider.iconName
    }
}
