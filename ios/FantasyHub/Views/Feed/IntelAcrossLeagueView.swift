import SwiftUI

/// "Across the League" tab of the Intel view.
/// Paginated signal feed with source/type/position filters.
struct IntelAcrossLeagueView: View {
    let signals: [Signal]
    let isLoading: Bool
    let isLoadingMore: Bool
    @Binding var sourceFilter: SignalSource?
    @Binding var typeFilter: SignalType?
    @Binding var positionFilter: String?
    @Binding var myRosterOnly: Bool
    let onRefresh: () async -> Void
    let onLoadMore: () async -> Void

    private let positions = ["QB", "RB", "WR", "TE", "K"]

    private var filteredSignals: [Signal] {
        signals.filter { signal in
            if let src = sourceFilter, signal.source != src { return false }
            if let type = typeFilter, signal.signalType != type { return false }
            if let pos = positionFilter,
               signal.player.position?.uppercased() != pos { return false }
            return true
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Theme.spacingMD) {
                filterChips
                    .padding(.horizontal, Theme.spacingMD)

                let display = filteredSignals
                if display.isEmpty && !isLoading {
                    emptyState
                } else {
                    ForEach(display) { signal in
                        NavigationLink {
                            PlayerDetailView(playerId: signal.player.id, playerName: signal.player.fullName)
                        } label: {
                            SignalCard(signal: signal)
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, Theme.spacingMD)
                        .onAppear {
                            if signal.id == display.last?.id {
                                Task { await onLoadMore() }
                            }
                        }
                    }

                    if isLoadingMore {
                        ProgressView()
                            .tint(Theme.accent)
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                }
            }
            .padding(.vertical, Theme.spacingMD)
        }
        .refreshable { await onRefresh() }
    }

    // MARK: - Filter Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.spacingSM) {
                FeedFilterChip(
                    label: "My Team",
                    icon: "person.fill",
                    color: Theme.accent,
                    isActive: myRosterOnly
                ) {
                    myRosterOnly.toggle()
                }

                Divider()
                    .frame(height: 20)
                    .background(Color.white.opacity(0.15))

                ForEach(positions, id: \.self) { pos in
                    FeedFilterChip(label: pos, isActive: positionFilter == pos) {
                        positionFilter = positionFilter == pos ? nil : pos
                    }
                }

                Divider()
                    .frame(height: 20)
                    .background(Color.white.opacity(0.15))

                FeedFilterChip(label: "Rankings", icon: "arrow.up.arrow.down", isActive: typeFilter == .rankingChange) {
                    typeFilter = typeFilter == .rankingChange ? nil : .rankingChange
                    sourceFilter = nil
                }
                FeedFilterChip(label: "Stats", icon: "chart.bar.fill", isActive: typeFilter == .statsUpdate) {
                    typeFilter = typeFilter == .statsUpdate ? nil : .statsUpdate
                    sourceFilter = nil
                }
                FeedFilterChip(label: "Social", icon: "bubble.left", isActive: typeFilter == .socialMention) {
                    typeFilter = typeFilter == .socialMention ? nil : .socialMention
                    sourceFilter = nil
                }

                Divider()
                    .frame(height: 20)
                    .background(Color.white.opacity(0.15))

                ForEach(SignalSource.allCases, id: \.self) { src in
                    FeedFilterChip(label: src.displayName, color: src.accentColor, isActive: sourceFilter == src) {
                        sourceFilter = sourceFilter == src ? nil : src
                        typeFilter = nil
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 16))
                .foregroundStyle(Theme.textSecondary)
            Text("No signals match your filters")
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
