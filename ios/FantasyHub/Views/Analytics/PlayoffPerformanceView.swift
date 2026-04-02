import SwiftUI
import Charts

struct PlayoffPerformanceView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var playoffs: [PlayoffPerformance] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.spacingLG) {
                if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        self.errorMessage = nil
                        Task { await loadData() }
                    }
                } else if !playoffs.isEmpty {
                    // Clutch rating chart
                    PlayoffClutchChart(data: playoffs)

                    // Summary cards
                    PlayoffSummaryCards(data: playoffs)

                    // Detailed breakdown
                    PlayoffBreakdownList(data: playoffs)
                }
            }
            .padding(.vertical, Theme.spacingMD)
            .padding(.bottom, 100)
        }
        .overlay {
            if isLoading && playoffs.isEmpty {
                GenericListSkeleton()
            }
        }
        .background(Theme.background)
        .navigationTitle("Playoff Performance")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: leagueStore.activeLeagueId) {
            playoffs = []
            errorMessage = nil
            await loadData()
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            playoffs = try await APIClient.shared.getPlayoffs(leagueId: leagueId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Clutch Chart

private struct PlayoffClutchChart: View {
    let data: [PlayoffPerformance]

    private var sorted: [PlayoffPerformance] {
        data.filter { $0.playoffGames > 0 }.sorted { $0.clutchRating > $1.clutchRating }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("CLUTCH RATING")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            Text("Playoff PPG minus Regular Season PPG. Positive = they step up when it matters.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.textSecondary)
                .padding(.horizontal, Theme.spacingMD)

            Chart(sorted) { entry in
                BarMark(
                    x: .value("Clutch", entry.clutchRating),
                    y: .value("Manager", entry.managerName)
                )
                .foregroundStyle(entry.clutchRating >= 0 ? Theme.win.gradient : Theme.loss.gradient)
                .annotation(position: entry.clutchRating >= 0 ? .trailing : .leading, spacing: 4) {
                    Text(String(format: "%+.1f", entry.clutchRating))
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(entry.clutchRating >= 0 ? Theme.win : Theme.loss)
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                        .foregroundStyle(Theme.surface)
                    AxisValueLabel()
                        .foregroundStyle(Theme.dimText)
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisValueLabel()
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(height: CGFloat(max(sorted.count, 1)) * 36)
            .padding(Theme.spacingMD)
            .cardStyle()
            .padding(.horizontal, Theme.spacingMD)
        }
    }
}

// MARK: - Summary Cards

private struct PlayoffSummaryCards: View {
    let data: [PlayoffPerformance]

    private var mostClutch: PlayoffPerformance? {
        data.filter { $0.playoffGames > 0 }.max { $0.clutchRating < $1.clutchRating }
    }

    private var biggestChoker: PlayoffPerformance? {
        data.filter { $0.playoffGames > 0 }.min { $0.clutchRating < $1.clutchRating }
    }

    private var mostGames: PlayoffPerformance? {
        data.max { $0.playoffGames < $1.playoffGames }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("HIGHLIGHTS")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.spacingSM) {
                if let clutch = mostClutch {
                    PlayoffHighlightCard(
                        title: "Most Clutch",
                        name: clutch.managerName,
                        value: String(format: "%+.1f", clutch.clutchRating),
                        valueColor: Theme.win,
                        icon: "flame.fill"
                    )
                }
                if let choker = biggestChoker, choker.clutchRating < 0 {
                    PlayoffHighlightCard(
                        title: "Biggest Drop-Off",
                        name: choker.managerName,
                        value: String(format: "%+.1f", choker.clutchRating),
                        valueColor: Theme.loss,
                        icon: "arrow.down.circle.fill"
                    )
                }
                if let most = mostGames {
                    PlayoffHighlightCard(
                        title: "Most Playoff Games",
                        name: most.managerName,
                        value: "\(most.playoffGames)",
                        valueColor: Theme.accent,
                        icon: "sportscourt.fill"
                    )
                }

                let avgPlayoffPPG = data.filter { $0.playoffGames > 0 }
                let leagueAvg = avgPlayoffPPG.isEmpty ? 0 : avgPlayoffPPG.reduce(0.0) { $0 + $1.playoffPPG } / Double(avgPlayoffPPG.count)
                PlayoffHighlightCard(
                    title: "League Avg Playoff PPG",
                    name: "",
                    value: String(format: "%.1f", leagueAvg),
                    valueColor: Theme.accent,
                    icon: "chart.bar.fill"
                )
            }
            .padding(.horizontal, Theme.spacingMD)
        }
    }
}

private struct PlayoffHighlightCard: View {
    let title: String
    let name: String
    let value: String
    let valueColor: Color
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(valueColor)

            Text(value)
                .font(Theme.statFont)
                .foregroundStyle(valueColor)

            if !name.isEmpty {
                Text(name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
            }

            Text(title)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.dimText)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}

// MARK: - Detailed Breakdown

private struct PlayoffBreakdownList: View {
    let data: [PlayoffPerformance]

    private var sorted: [PlayoffPerformance] {
        data.filter { $0.playoffGames > 0 }.sorted { $0.clutchRating > $1.clutchRating }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("ALL MANAGERS")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            VStack(spacing: 0) {
                ForEach(Array(sorted.enumerated()), id: \.element.id) { index, entry in
                    HStack {
                        VStack(alignment: .leading, spacing: Theme.spacingXS) {
                            Text(entry.managerName)
                                .font(Theme.titleFont)
                                .foregroundStyle(Theme.textPrimary)

                            HStack(spacing: Theme.spacingMD) {
                                MiniStat(label: "Reg PPG", value: String(format: "%.1f", entry.regularSeasonPPG))
                                MiniStat(label: "Playoff PPG", value: String(format: "%.1f", entry.playoffPPG))
                                MiniStat(label: "Games", value: "\(entry.playoffGames)")
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            Text(String(format: "%+.1f", entry.clutchRating))
                                .font(Theme.statFont)
                                .foregroundStyle(clutchColor(entry.clutchRating))
                            Text(clutchLabel(entry.clutchRating))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(clutchColor(entry.clutchRating))
                        }
                    }
                    .padding(Theme.spacingMD)
                    .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)

                    if index < sorted.count - 1 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .padding(.horizontal, Theme.spacingMD)
    }

    private func clutchColor(_ rating: Double) -> Color {
        rating > 2 ? Theme.win : rating < -2 ? Theme.loss : Theme.dimText
    }

    private func clutchLabel(_ rating: Double) -> String {
        rating > 2 ? "CLUTCH" : rating < -2 ? "CHOKE" : "NEUTRAL"
    }
}
