import SwiftUI

/// Full detail view for an IntelligenceCard.
/// Shows card summary at top, then the raw signals for each involved player.
struct IntelCardDetailView: View {
    let card: IntelligenceCard

    @State private var playerDetails: [PlayerDetail] = []
    @State private var rankingHistory: [String: [RankHistoryPoint]] = [:]  // playerId → points
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.spacingLG) {
                cardSummary
                signalsSection
            }
            .padding(.vertical, Theme.spacingMD)
        }
        .background(Theme.background)
        .navigationTitle(card.type.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    // MARK: - Card Summary

    private var cardSummary: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            // Type badge + confidence
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: card.type.systemIcon)
                        .font(.system(size: 12, weight: .semibold))
                    Text(card.type.displayName.uppercased())
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                }
                .foregroundStyle(card.type.accentColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(card.type.accentColor.opacity(0.12))
                .clipShape(Capsule())

                Spacer()

                // Confidence dots
                HStack(spacing: 3) {
                    ForEach(1...4, id: \.self) { i in
                        Circle()
                            .fill(i <= card.confidence
                                ? card.type.accentColor
                                : card.type.accentColor.opacity(0.2))
                            .frame(width: 7, height: 7)
                    }
                }
            }

            // Headline
            Text(card.headline)
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            // Body
            Text(card.body)
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            // Players
            if !card.players.isEmpty {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(card.players) { player in
                        HStack(spacing: 5) {
                            if let pos = player.position {
                                Text(pos)
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(player.positionColor)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(player.positionColor.opacity(0.15))
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                            }
                            Text(player.fullName)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.textPrimary)
                            if let team = player.nflTeam {
                                Text(team)
                                    .font(Theme.captionFont)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                        if player.id != card.players.last?.id {
                            Text("·")
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
            }

            // Source chips
            if !card.sources.isEmpty {
                HStack(spacing: 6) {
                    Text("Sources:")
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textSecondary)
                    ForEach(card.sources, id: \.self) { source in
                        if let src = SignalSource(rawValue: source) {
                            Text(src.displayName)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(src.accentColor)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(src.accentColor.opacity(0.12))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .padding(Theme.spacingMD)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .strokeBorder(card.type.accentColor.opacity(0.25), lineWidth: 1)
        )
        .padding(.horizontal, Theme.spacingMD)
    }

    // MARK: - Signals Section

    @ViewBuilder
    private var signalsSection: some View {
        if isLoading && playerDetails.isEmpty {
            VStack(spacing: Theme.spacingSM) {
                ForEach(0..<4, id: \.self) { _ in
                    ShimmerBlock(height: 80)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
        } else if let error = errorMessage {
            ErrorStateView(message: error) {
                errorMessage = nil
                Task { await load() }
            }
            .padding(Theme.spacingLG)
        } else {
            ForEach(playerDetails) { player in
                playerSignalSection(player: player)
            }
        }
    }

    private func playerSignalSection(player: PlayerDetail) -> some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Player section header
            HStack(spacing: Theme.spacingSM) {
                ZStack {
                    Circle()
                        .fill(player.positionColor.opacity(0.15))
                        .frame(width: 32, height: 32)
                    Text(player.position ?? "?")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(player.positionColor)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(player.fullName)
                        .font(Theme.titleFont)
                        .foregroundStyle(Theme.textPrimary)
                    if let team = player.nflTeam {
                        Text(team)
                            .font(Theme.captionFont)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()
                Text("\(player.signals.count) signals")
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(.horizontal, Theme.spacingMD)

            // For RANKING_SHIFT cards, show the ranking trend chart instead of raw signal rows
            if card.type == .rankingShift {
                rankingChartSection(for: player)
                    .padding(.horizontal, Theme.spacingMD)
            } else if player.signals.isEmpty {
                Text("No recent signals")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.horizontal, Theme.spacingMD)
            } else {
                ForEach(player.signals) { signal in
                    PlayerSignalRowView(signal: signal)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
    }

    @ViewBuilder
    private func rankingChartSection(for player: PlayerDetail) -> some View {
        if isLoading {
            RankingTrendChartSkeleton()
        } else if let points = rankingHistory[player.id], !points.isEmpty {
            RankingTrendChart(points: points)
        } else {
            RankingTrendChartEmpty()
        }
    }

    // MARK: - Data Loading

    private func load() async {
        isLoading = true
        do {
            playerDetails = try await withThrowingTaskGroup(of: PlayerDetail.self) { group in
                for player in card.players {
                    group.addTask {
                        try await APIClient.shared.getPlayer(playerId: player.id)
                    }
                }
                var results: [PlayerDetail] = []
                for try await detail in group {
                    results.append(detail)
                }
                // Preserve card.players order
                return card.players.compactMap { p in results.first { $0.id == p.id } }
            }

            // For ranking shift cards, fetch the trend data for each player in parallel
            if card.type == .rankingShift {
                rankingHistory = try await withThrowingTaskGroup(of: (String, [RankHistoryPoint]).self) { group in
                    for player in card.players {
                        group.addTask {
                            let points = try await APIClient.shared.fetchRankingHistory(playerId: player.id)
                            return (player.id, points)
                        }
                    }
                    var result: [String: [RankHistoryPoint]] = [:]
                    for try await (playerId, points) in group {
                        result[playerId] = points
                    }
                    return result
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Signal Row (shared, used here and potentially elsewhere)

struct PlayerSignalRowView: View {
    let signal: PlayerSignal

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(signal.source.accentColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: signal.signalType.systemIcon)
                            .font(.system(size: 10))
                        Text(signal.source.displayName)
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(signal.source.accentColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(signal.source.accentColor.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 5))

                    Spacer()

                    Text(signal.relativeTime)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.textSecondary)
                }

                Text(signal.content)
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Theme.spacingMD)
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }
}
