import SwiftUI

/// "My Team" tab of the Intel view.
/// Shows action items at top, then roster players grouped by player with their signals.
struct IntelMyTeamView: View {
    let briefing: TodaysBriefingResponse?
    let rosterNews: [Signal]
    let isLoading: Bool
    let isInitialLoad: Bool
    let onRefresh: () async -> Void

    /// Group rosterNews by player, sorted by signal count descending.
    /// Players with no signals are omitted entirely.
    private var playerGroups: [(player: FeedPlayer, signals: [Signal])] {
        var map: [String: (player: FeedPlayer, signals: [Signal])] = [:]
        for signal in rosterNews {
            let pid = signal.player.id
            if map[pid] != nil {
                map[pid]!.signals.append(signal)
            } else {
                map[pid] = (signal.player, [signal])
            }
        }
        return map.values.sorted { $0.signals.count > $1.signals.count }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Theme.spacingLG) {
                if isLoading && isInitialLoad {
                    loadingSkeleton
                } else {
                    TodaysBriefingView(briefing: briefing, isLoading: isLoading)
                    rosterSection
                }
            }
            .padding(.vertical, Theme.spacingMD)
        }
        .refreshable { await onRefresh() }
    }

    // MARK: - Roster Section

    @ViewBuilder
    private var rosterSection: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            sectionHeader(title: "MY ROSTER", icon: "person.fill", color: Theme.textSecondary)

            if playerGroups.isEmpty && !isLoading {
                emptyRoster
            } else {
                ForEach(playerGroups, id: \.player.id) { group in
                    PlayerSignalGroupView(player: group.player, signals: group.signals)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
    }

    private var emptyRoster: some View {
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

    // MARK: - Loading Skeleton

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Theme.spacingLG) {
            VStack(spacing: Theme.spacingSM) {
                ShimmerBlock(width: 120, height: 16)
                    .padding(.horizontal, Theme.spacingMD)
                ShimmerBlock(height: 56)
                    .padding(.horizontal, Theme.spacingMD)
                ShimmerBlock(height: 56)
                    .padding(.horizontal, Theme.spacingMD)
            }
            VStack(spacing: Theme.spacingSM) {
                ShimmerBlock(width: 100, height: 16)
                    .padding(.horizontal, Theme.spacingMD)
                ForEach(0..<3, id: \.self) { _ in
                    ShimmerBlock(height: 140)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
    }

    // MARK: - Section Header

    private func sectionHeader(title: String, icon: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(color)
            Text(title)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(color == Theme.accent ? color : Theme.textSecondary)
        }
        .padding(.horizontal, Theme.spacingMD)
    }
}
