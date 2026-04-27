import SwiftUI

/// Displays signals filtered to the user's current roster (and optionally their opponent).
/// Used as the "Roster News" middle section in IntelView.
struct RosterDigestView: View {
    let signals: [Signal]
    let isLoading: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            SectionHeader(title: "ROSTER NEWS", icon: "person.fill")

            if isLoading && signals.isEmpty {
                ForEach(0..<3, id: \.self) { _ in
                    ShimmerBlock(height: 88)
                        .padding(.horizontal, Theme.spacingMD)
                }
            } else if signals.isEmpty {
                emptyState
            } else {
                ForEach(signals) { signal in
                    NavigationLink {
                        PlayerDetailView(playerId: signal.player.id, playerName: signal.player.fullName)
                    } label: {
                        SignalCard(signal: signal)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
    }

    private var emptyState: some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: "person.slash")
                .font(.system(size: 16))
                .foregroundStyle(Theme.textSecondary)
            Text("No roster news this week")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(Theme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .padding(.horizontal, Theme.spacingMD)
    }
}

// MARK: - Section Header

private struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.accent)
            Text(title)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.horizontal, Theme.spacingMD)
    }
}
