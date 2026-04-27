import SwiftUI

struct LeagueSwitcher: View {
    @EnvironmentObject var leagueStore: LeagueStore

    var body: some View {
        Menu {
            ForEach(leagueStore.leagues) { league in
                Button {
                    leagueStore.setActiveLeague(league.id)
                } label: {
                    HStack {
                        Text(league.name)
                        if league.id == leagueStore.activeLeagueId {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Text(leagueStore.activeLeague?.name ?? "Select League")
                    .font(Theme.titleFont)
                    .foregroundStyle(Theme.textPrimary)
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }
        }
    }
}
