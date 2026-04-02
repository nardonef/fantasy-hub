import SwiftUI
import Charts

struct ScoringDetailView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var scoringData: [ScoringData] = []
    @State private var luckData: [LuckIndex] = []
    @State private var selectedView: ScoringTab = .overview
    @State private var isLoading = true
    @State private var errorMessage: String?

    let year: Int?

    enum ScoringTab: String, CaseIterable {
        case overview = "Overview"
        case trends = "Trends"
        case luck = "Luck Index"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.spacingLG) {
                if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        self.errorMessage = nil
                        Task { await loadData() }
                    }
                } else {
                    Picker("View", selection: $selectedView) {
                        ForEach(ScoringTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, Theme.spacingMD)

                    switch selectedView {
                    case .overview:
                        ScoringOverview(data: scoringData)
                    case .trends:
                        ScoringTrends(data: scoringData)
                    case .luck:
                        LuckIndexView(data: luckData)
                    }
                }
            }
            .padding(.vertical, Theme.spacingMD)
            .padding(.bottom, 100)
        }
        .overlay {
            if isLoading && scoringData.isEmpty {
                GenericListSkeleton()
            }
        }
        .background(Theme.background)
        .navigationTitle("Scoring & Trends")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: leagueStore.activeLeagueId) {
            scoringData = []
            luckData = []
            errorMessage = nil
            await loadData()
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            scoringData = try await APIClient.shared.getScoring(leagueId: leagueId, year: year, includeWeekly: true)
            let standings = try await APIClient.shared.getStandings(leagueId: leagueId, year: year)
            luckData = calculateLuckIndex(scoring: scoringData, standings: standings)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Scoring Overview

struct ScoringOverview: View {
    let data: [ScoringData]

    private var sorted: [ScoringData] { data.sorted { $0.avgPoints > $1.avgPoints } }

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            // Avg points chart
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                Text("AVERAGE POINTS PER WEEK")
                    .sectionHeaderStyle()
                    .padding(.horizontal, Theme.spacingMD)

                Chart(sorted) { entry in
                    BarMark(
                        x: .value("Avg", entry.avgPoints),
                        y: .value("Manager", entry.managerName)
                    )
                    .foregroundStyle(Theme.accent.gradient)
                    .annotation(position: .trailing, spacing: 4) {
                        Text(String(format: "%.1f", entry.avgPoints))
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks { value in
                        AxisValueLabel()
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(height: CGFloat(sorted.count) * 36)
                .padding(Theme.spacingMD)
            }
            .cardStyle()

            // Stats table
            VStack(spacing: 0) {
                ForEach(Array(sorted.enumerated()), id: \.element.id) { index, entry in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.managerName)
                                .font(Theme.titleFont)
                                .foregroundStyle(Theme.textPrimary)
                            Text("\(entry.gamesPlayed) games played")
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.dimText)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            HStack(spacing: Theme.spacingMD) {
                                StatColumn(label: "High", value: String(format: "%.1f", entry.maxPoints), color: Theme.win)
                                StatColumn(label: "Low", value: String(format: "%.1f", entry.minPoints), color: Theme.loss)
                                StatColumn(label: "StdDev", value: String(format: "%.1f", entry.consistency), color: Theme.textSecondary)
                            }
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
}

struct StatColumn: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(Theme.dimText)
        }
        .frame(width: 48)
    }
}

// MARK: - Scoring Trends (line chart)

struct ScoringTrends: View {
    let data: [ScoringData]

    @State private var selectedManagers: Set<String> = []
    @State private var showSeasonPPG = false

    private var displayData: [ScoringData] {
        if selectedManagers.isEmpty {
            return Array(data.sorted { $0.avgPoints > $1.avgPoints }.prefix(4))
        }
        return data.filter { selectedManagers.contains($0.managerId) }
    }

    private let managerColors: [Color] = [
        Theme.accent, Theme.win, Theme.loss, .cyan, .purple, .orange, .pink, .mint
    ]

    /// Sorted unique years across all displayed managers
    private var allYears: [Int] {
        let years = displayData.flatMap { ($0.weeklyScores ?? []).map(\.year) }
        return Array(Set(years)).sorted()
    }

    /// Assigns a continuous index to each (year, week) pair for a smooth x-axis
    private func continuousIndex(year: Int, week: Int, scores: [WeeklyScore]) -> Int {
        let sorted = scores.sorted { ($0.year, $0.week) < ($1.year, $1.week) }
        return sorted.firstIndex { $0.year == year && $0.week == week } ?? 0
    }

    /// Computes a 4-week rolling average for a set of weekly scores
    private func rollingAverage(_ scores: [WeeklyScore], window: Int = 4) -> [(index: Int, value: Double)] {
        let sorted = scores.sorted { ($0.year, $0.week) < ($1.year, $1.week) }
        guard sorted.count >= window else { return [] }
        var result: [(index: Int, value: Double)] = []
        for i in (window - 1)..<sorted.count {
            let windowSlice = sorted[(i - window + 1)...i]
            let avg = windowSlice.reduce(0.0) { $0 + $1.score } / Double(window)
            result.append((index: i, value: avg))
        }
        return result
    }

    /// Finds peak and valley scores for a manager
    private func peakValley(_ scores: [WeeklyScore]) -> (peak: WeeklyScore?, valley: WeeklyScore?) {
        guard scores.count >= 3 else { return (nil, nil) }
        let sorted = scores.sorted { ($0.year, $0.week) < ($1.year, $1.week) }
        let peak = sorted.max { $0.score < $1.score }
        let valley = sorted.min { $0.score < $1.score }
        return (peak, valley)
    }

    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            // Manager toggles
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(data.sorted(by: { $0.avgPoints > $1.avgPoints })) { entry in
                        let isOn = selectedManagers.isEmpty
                            ? displayData.contains(where: { $0.managerId == entry.managerId })
                            : selectedManagers.contains(entry.managerId)

                        Button {
                            if selectedManagers.isEmpty {
                                selectedManagers = Set(displayData.map(\.managerId))
                            }
                            if selectedManagers.contains(entry.managerId) {
                                selectedManagers.remove(entry.managerId)
                            } else {
                                selectedManagers.insert(entry.managerId)
                            }
                        } label: {
                            Text(entry.managerName.split(separator: " ").first.map(String.init) ?? entry.managerName)
                                .font(.system(size: 11, weight: .semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(isOn ? Theme.accent.opacity(0.2) : Theme.card)
                                .foregroundStyle(isOn ? Theme.accent : Theme.dimText)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal, Theme.spacingMD)
            }

            // Season PPG toggle
            HStack {
                Spacer()
                Button {
                    showSeasonPPG.toggle()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: showSeasonPPG ? "chart.line.uptrend.xyaxis" : "waveform.path.ecg")
                            .font(.system(size: 11))
                        Text(showSeasonPPG ? "Season PPG" : "Weekly")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(Theme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Theme.accent.opacity(0.15))
                    .clipShape(Capsule())
                }
                .padding(.trailing, Theme.spacingMD)
            }

            if showSeasonPPG {
                // Season PPG line chart
                Chart {
                    ForEach(Array(displayData.enumerated()), id: \.element.managerId) { index, entry in
                        ForEach(entry.seasonAverages) { sa in
                            LineMark(
                                x: .value("Season", String(sa.year)),
                                y: .value("PPG", sa.avgPoints),
                                series: .value("Manager", entry.managerName)
                            )
                            .foregroundStyle(managerColors[index % managerColors.count])
                            .lineStyle(StrokeStyle(lineWidth: 2.5))
                            .symbol(Circle())
                            .symbolSize(30)

                            PointMark(
                                x: .value("Season", String(sa.year)),
                                y: .value("PPG", sa.avgPoints)
                            )
                            .foregroundStyle(managerColors[index % managerColors.count])
                            .annotation(position: .top, spacing: 4) {
                                Text(String(format: "%.1f", sa.avgPoints))
                                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(managerColors[index % managerColors.count])
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            .foregroundStyle(Theme.surface)
                        AxisValueLabel()
                            .foregroundStyle(Theme.dimText)
                    }
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                            .foregroundStyle(Theme.dimText)
                    }
                }
                .frame(height: 260)
                .padding(Theme.spacingMD)
                .cardStyle()
                .padding(.horizontal, Theme.spacingMD)
            } else {
                // Weekly line chart with continuous x-axis + rolling average
                Chart {
                    ForEach(Array(displayData.enumerated()), id: \.element.managerId) { index, entry in
                        let scores = (entry.weeklyScores ?? []).sorted { ($0.year, $0.week) < ($1.year, $1.week) }
                        let color = managerColors[index % managerColors.count]

                        // Raw weekly data
                        ForEach(scores.indices, id: \.self) { i in
                            LineMark(
                                x: .value("Index", i),
                                y: .value("Score", scores[i].score),
                                series: .value("Manager", entry.managerName)
                            )
                            .foregroundStyle(color)
                            .lineStyle(StrokeStyle(lineWidth: 1.5))
                        }

                        // 4-week rolling average
                        let rolling = rollingAverage(entry.weeklyScores ?? [])
                        ForEach(rolling.indices, id: \.self) { i in
                            LineMark(
                                x: .value("Index", rolling[i].index),
                                y: .value("Score", rolling[i].value),
                                series: .value("Avg-\(entry.managerName)", entry.managerName + " avg")
                            )
                            .foregroundStyle(color.opacity(0.5))
                            .lineStyle(StrokeStyle(lineWidth: 3))
                        }

                        // Peak and valley annotations
                        let pv = peakValley(entry.weeklyScores ?? [])
                        if let peak = pv.peak,
                           let peakIdx = scores.firstIndex(where: { $0.year == peak.year && $0.week == peak.week }) {
                            PointMark(
                                x: .value("Index", peakIdx),
                                y: .value("Score", peak.score)
                            )
                            .foregroundStyle(color)
                            .symbolSize(40)
                            .annotation(position: .top, spacing: 2) {
                                Text(String(format: "%.0f", peak.score))
                                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                                    .foregroundStyle(color)
                            }
                        }
                        if let valley = pv.valley,
                           let valIdx = scores.firstIndex(where: { $0.year == valley.year && $0.week == valley.week }) {
                            PointMark(
                                x: .value("Index", valIdx),
                                y: .value("Score", valley.score)
                            )
                            .foregroundStyle(color)
                            .symbolSize(40)
                            .annotation(position: .bottom, spacing: 2) {
                                Text(String(format: "%.0f", valley.score))
                                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                                    .foregroundStyle(color)
                            }
                        }
                    }

                    // Season boundary vertical rules
                    ForEach(Array(displayData.prefix(1)), id: \.managerId) { entry in
                        let scores = (entry.weeklyScores ?? []).sorted { ($0.year, $0.week) < ($1.year, $1.week) }
                        let years = scores.map(\.year)
                        var boundaryIndices: [Int] = []

                        let _ = {
                            for i in 1..<years.count where years[i] != years[i - 1] {
                                boundaryIndices.append(i)
                            }
                        }()

                        ForEach(boundaryIndices, id: \.self) { idx in
                            RuleMark(x: .value("Index", idx))
                                .foregroundStyle(Theme.accent.opacity(0.3))
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                                .annotation(position: .top, alignment: .leading, spacing: 2) {
                                    if idx < scores.count {
                                        Text(String(scores[idx].year))
                                            .font(.system(size: 8, weight: .bold))
                                            .foregroundStyle(Theme.accent.opacity(0.6))
                                    }
                                }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            .foregroundStyle(Theme.surface)
                        AxisValueLabel()
                            .foregroundStyle(Theme.dimText)
                    }
                }
                .chartXAxis(.hidden)
                .frame(height: 260)
                .padding(Theme.spacingMD)
                .cardStyle()
                .padding(.horizontal, Theme.spacingMD)
            }
        }
    }
}

// MARK: - Luck Index

struct LuckIndex: Identifiable {
    let id: String
    let managerName: String
    let expectedWins: Double
    let actualWins: Int
    let luckScore: Double // positive = lucky, negative = unlucky
    let avgPointsFor: Double
    let avgPointsAgainst: Double
}

func calculateLuckIndex(scoring: [ScoringData], standings: [StandingsEntry]) -> [LuckIndex] {
    // Luck = actual wins - expected wins
    // Expected wins: for each week, what % of the league would you beat?
    let allWeeklyScores: [String: [Double]] = Dictionary(
        uniqueKeysWithValues: scoring.map { ($0.managerId, ($0.weeklyScores ?? []).map(\.score)) }
    )

    let managerCount = scoring.count

    return scoring.compactMap { entry -> LuckIndex? in
        guard let standing = standings.first(where: { $0.managerId == entry.managerId }) else { return nil }

        // For each week, count how many managers this manager would beat
        var expectedWins = 0.0
        let entryWeeklyScores = entry.weeklyScores ?? []
        for score in entryWeeklyScores {
            let weekScores = allWeeklyScores.values.compactMap { scores -> Double? in
                scores.indices.contains(entryWeeklyScores.firstIndex(where: { $0.week == score.week && $0.year == score.year }) ?? -1)
                    ? scores[entryWeeklyScores.firstIndex(where: { $0.week == score.week && $0.year == score.year })!]
                    : nil
            }
            let beaten = weekScores.filter { $0 < score.score }.count
            expectedWins += Double(beaten) / Double(max(managerCount - 1, 1))
        }

        let luck = Double(standing.wins) - expectedWins
        let totalGames = max(standing.wins + standing.losses + standing.ties, 1)

        return LuckIndex(
            id: entry.managerId,
            managerName: entry.managerName,
            expectedWins: expectedWins,
            actualWins: standing.wins,
            luckScore: luck,
            avgPointsFor: entry.avgPoints,
            avgPointsAgainst: standing.pointsAgainst / Double(totalGames)
        )
    }
    .sorted { $0.luckScore > $1.luckScore }
}

struct LuckIndexView: View {
    let data: [LuckIndex]

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            Text("Luck measures the gap between expected wins (based on your scores vs the whole league) and actual wins. Positive = lucky schedule, negative = unlucky.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.textSecondary)
                .padding(.horizontal, Theme.spacingMD)

            VStack(spacing: 0) {
                ForEach(Array(data.enumerated()), id: \.element.id) { index, entry in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.managerName)
                                .font(Theme.titleFont)
                                .foregroundStyle(Theme.textPrimary)

                            HStack(spacing: Theme.spacingMD) {
                                MiniStat(label: "Actual W", value: "\(entry.actualWins)")
                                MiniStat(label: "Expected W", value: String(format: "%.1f", entry.expectedWins))
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            Text(String(format: "%+.1f", entry.luckScore))
                                .font(Theme.statFont)
                                .foregroundStyle(entry.luckScore > 0 ? Theme.win : entry.luckScore < 0 ? Theme.loss : Theme.textSecondary)

                            Text(entry.luckScore > 1 ? "LUCKY" : entry.luckScore < -1 ? "UNLUCKY" : "NEUTRAL")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(entry.luckScore > 1 ? Theme.win : entry.luckScore < -1 ? Theme.loss : Theme.dimText)
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
        }
        .padding(.horizontal, Theme.spacingMD)
    }
}
