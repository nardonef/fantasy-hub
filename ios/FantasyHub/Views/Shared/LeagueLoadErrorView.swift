import SwiftUI

/// Full-screen error shown when the initial league fetch fails at launch.
/// Keeps the user in their authenticated session and offers a retry.
struct LeagueLoadErrorView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    let onRetry: () -> Void

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: Theme.spacingLG) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 52, weight: .light))
                    .foregroundStyle(Theme.accent)

                VStack(spacing: Theme.spacingSM) {
                    Text("Couldn't Load Leagues")
                        .font(Theme.titleFont)
                        .foregroundStyle(Theme.textPrimary)

                    Text("Check your connection and try again.")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                }

                Button {
                    onRetry()
                } label: {
                    HStack(spacing: Theme.spacingSM) {
                        if leagueStore.isLoading {
                            ProgressView()
                                .tint(Theme.background)
                                .controlSize(.small)
                        }
                        Text(leagueStore.isLoading ? "Retrying…" : "Try Again")
                            .font(Theme.bodyFont.weight(.semibold))
                            .foregroundStyle(Theme.background)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.spacingMD)
                    .background(Theme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .disabled(leagueStore.isLoading)
                .padding(.horizontal, Theme.spacingXL)
            }
            .padding(Theme.spacingXL)
        }
    }
}
