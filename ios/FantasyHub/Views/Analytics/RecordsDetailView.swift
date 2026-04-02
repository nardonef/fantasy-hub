import SwiftUI
import Charts

struct RecordsDetailView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var records: RecordsResponse?
    @State private var extremes: ExtremesResponse?
    @State private var playoffs: [PlayoffPerformance] = []
    @State private var distribution: DistributionResponse?
    @State private var selectedTab: RecordsTab = .topPerformances
    @State private var isLoading = true
    @State private var errorMessage: String?

    enum RecordsTab: String, CaseIterable {
        case topPerformances = "Top Scores"
        case bottomPerformances = "Bottom Scores"
        case closestGames = "Nail Biters"
        case blowouts = "Blowouts"
        case champions = "Champions"
        case distribution = "Distribution"
        case clutch = "Clutch"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.spacingLG) {
                if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        self.errorMessage = nil
                        Task { await loadData() }
                    }
                }

                // Tab selector
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(RecordsTab.allCases, id: \.self) { tab in
                            Button {
                                selectedTab = tab
                            } label: {
                                Text(tab.rawValue)
                                    .font(.system(size: 12, weight: .semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .background(selectedTab == tab ? Theme.accent : Theme.card)
                                    .foregroundStyle(selectedTab == tab ? Theme.charcoal : Theme.textSecondary)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, Theme.spacingMD)
                }

                switch selectedTab {
                case .topPerformances:
                    if let extremes {
                        PerformanceList(title: "TOP PERFORMANCES", performances: extremes.topPerformances, isTop: true)
                    }
                case .bottomPerformances:
                    if let extremes {
                        PerformanceList(title: "BOTTOM PERFORMANCES", performances: extremes.bottomPerformances, isTop: false)
                    }
                case .closestGames:
                    if let extremes {
                        GameResultList(title: "NAIL BITERS", games: extremes.closestGames, showMargin: true)
                    }
                case .blowouts:
                    if let extremes {
                        GameResultList(title: "BIGGEST BLOWOUTS", games: extremes.biggestBlowouts, showMargin: true)
                    }
                case .champions:
                    if let records {
                        ChampionHistoryView(champions: records.champions)
                    }
                case .distribution:
                    if let distribution {
                        ScoreDistributionView(data: distribution)
                    }
                case .clutch:
                    ClutchRatingView(data: playoffs)
                }
            }
            .padding(.vertical, Theme.spacingMD)
            .padding(.bottom, 100)
        }
        .overlay {
            if isLoading && extremes == nil {
                GenericListSkeleton()
            }
        }
        .background(Theme.background)
        .navigationTitle("Records & Milestones")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: leagueStore.activeLeagueId) {
            records = nil
            extremes = nil
            playoffs = []
            distribution = nil
            errorMessage = nil
            await loadData()
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            async let r = APIClient.shared.getRecords(leagueId: leagueId)
            async let e = APIClient.shared.getExtremes(leagueId: leagueId)
            async let p = APIClient.shared.getPlayoffs(leagueId: leagueId)
            async let d = APIClient.shared.getDistribution(leagueId: leagueId)

            records = try await r
            extremes = try await e
            playoffs = try await p
            distribution = try await d
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Top/Bottom Performance List

struct PerformanceList: View {
    let title: String
    let performances: [GamePerformance]
    let isTop: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text(title)
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            VStack(spacing: 0) {
                ForEach(Array(performances.enumerated()), id: \.element.id) { index, perf in
                    HStack(spacing: Theme.spacingSM) {
                        Text("\(index + 1)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(index < 3 ? Theme.accent : Theme.dimText)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(perf.manager)
                                .font(Theme.titleFont)
                                .foregroundStyle(Theme.textPrimary)
                            Text("vs \(perf.opponent) (\(String(format: "%.1f", perf.opponentScore)))")
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.dimText)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            Text(String(format: "%.1f", perf.score))
                                .font(Theme.statFont)
                                .foregroundStyle(isTop ? Theme.win : Theme.loss)
                            Text(verbatim: "Wk \(perf.week), \(perf.year)")
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.dimText)
                        }
                    }
                    .padding(Theme.spacingMD)
                    .rankAccentStyle(rank: index + 1)
                    .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)

                    if index < performances.count - 1 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .padding(.horizontal, Theme.spacingMD)
    }
}

// MARK: - Game Result List (Closest/Blowouts)

struct GameResultList: View {
    let title: String
    let games: [GameResult]
    let showMargin: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text(title)
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            VStack(spacing: 0) {
                ForEach(Array(games.enumerated()), id: \.element.id) { index, game in
                    HStack(spacing: Theme.spacingSM) {
                        Text("\(index + 1)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(index < 3 ? Theme.accent : Theme.dimText)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(game.winner)
                                    .font(Theme.titleFont)
                                    .foregroundStyle(Theme.win)
                                Text("def.")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.dimText)
                                Text(game.loser)
                                    .font(Theme.titleFont)
                                    .foregroundStyle(Theme.loss)
                            }
                            HStack(spacing: 8) {
                                Text("\(String(format: "%.1f", game.winnerScore)) - \(String(format: "%.1f", game.loserScore))")
                                    .font(Theme.tabularFont)
                                    .foregroundStyle(Theme.textSecondary)
                                Text(verbatim: "Wk \(game.week), \(game.year)")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Theme.dimText)
                                if game.matchupType != "REGULAR" {
                                    Text(game.matchupType)
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(Theme.accent)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Theme.accent.opacity(0.15))
                                        .clipShape(Capsule())
                                }
                            }
                        }

                        Spacer()

                        if showMargin {
                            Text(String(format: "%.1f", game.margin))
                                .font(Theme.statFont)
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .padding(Theme.spacingMD)
                    .rankAccentStyle(rank: index + 1)
                    .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)

                    if index < games.count - 1 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .padding(.horizontal, Theme.spacingMD)
    }
}

// MARK: - Champion History

struct ChampionHistoryView: View {
    let champions: [ChampionRecord]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("CHAMPION HISTORY")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            if !champions.isEmpty {
                Chart(champions, id: \.year) { champ in
                    BarMark(
                        x: .value("Year", String(champ.year)),
                        y: .value("Count", 1)
                    )
                    .foregroundStyle(Theme.accent.gradient)
                    .annotation(position: .top, spacing: 4) {
                        Text(champ.manager.split(separator: " ").first.map(String.init) ?? champ.manager)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .chartYAxis(.hidden)
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel()
                            .foregroundStyle(Theme.dimText)
                    }
                }
                .frame(height: 120)
                .padding(Theme.spacingMD)
                .cardStyle()
                .padding(.horizontal, Theme.spacingMD)
            }

            VStack(spacing: 0) {
                ForEach(Array(champions.enumerated()), id: \.element.year) { index, champ in
                    HStack {
                        Image(systemName: "trophy.fill")
                            .foregroundStyle(Theme.accent)
                            .font(.system(size: 18))

                        Text(verbatim: "\(champ.year)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(Theme.dimText)

                        Text(champ.manager)
                            .font(Theme.titleFont)
                            .foregroundStyle(Theme.textPrimary)

                        Spacer()
                    }
                    .padding(Theme.spacingMD)
                    .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)

                    if index < champions.count - 1 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .padding(.horizontal, Theme.spacingMD)
        }
    }
}

// MARK: - Score Distribution Histogram

struct ScoreDistributionView: View {
    let data: DistributionResponse

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("SCORE DISTRIBUTION")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            // Summary stats
            HStack(spacing: Theme.spacingLG) {
                MiniStat(label: "Total Scores", value: "\(data.totalScores)")
                MiniStat(label: "Mean", value: String(format: "%.1f", data.mean))
                MiniStat(label: "Median", value: String(format: "%.1f", data.median))
            }
            .padding(Theme.spacingMD)
            .cardStyle()
            .padding(.horizontal, Theme.spacingMD)

            // Histogram
            Chart(data.buckets) { bucket in
                BarMark(
                    x: .value("Range", bucket.label),
                    y: .value("Count", bucket.count)
                )
                .foregroundStyle(Theme.accent.gradient)
                .annotation(position: .top, spacing: 2) {
                    if bucket.count > 0 {
                        Text("\(bucket.count)")
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .foregroundStyle(Theme.dimText)
                    }
                }
            }
            .chartYAxis {
                AxisMarks { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                        .foregroundStyle(Theme.surface)
                    AxisValueLabel()
                        .foregroundStyle(Theme.dimText)
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel(orientation: .vertical)
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.dimText)
                }
            }
            .frame(height: 220)
            .padding(Theme.spacingMD)
            .cardStyle()
            .padding(.horizontal, Theme.spacingMD)
        }
    }
}

// MARK: - Clutch / Playoff Performance

struct ClutchRatingView: View {
    let data: [PlayoffPerformance]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("CLUTCH RATINGS")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            Text("Clutch = Playoff PPG minus Regular Season PPG. Green means they elevate in the playoffs.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.textSecondary)
                .padding(.horizontal, Theme.spacingMD)

            if data.isEmpty {
                Text("No playoff data available yet.")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.dimText)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.spacingLG)
                    .cardStyle()
                    .padding(.horizontal, Theme.spacingMD)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(data.enumerated()), id: \.element.id) { index, entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
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

                        if index < data.count - 1 {
                            Divider().background(Theme.surface)
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .padding(.horizontal, Theme.spacingMD)
            }
        }
    }

    private func clutchColor(_ rating: Double) -> Color {
        rating > 2 ? Theme.win : rating < -2 ? Theme.loss : Theme.dimText
    }

    private func clutchLabel(_ rating: Double) -> String {
        rating > 2 ? "CLUTCH" : rating < -2 ? "CHOKE" : "NEUTRAL"
    }
}
