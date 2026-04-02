import SwiftUI
import Charts

struct AnalyticsView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var selectedFilter: SeasonFilter = .allTime
    @State private var standings: [StandingsEntry] = []
    @State private var h2hData: H2HResponse?
    @State private var scoringData: [ScoringData] = []
    @State private var records: RecordsResponse?
    @State private var draftPicks: [DraftPickEntry] = []
    @State private var playoffs: [PlayoffPerformance] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    // Per-section loading states
    @State private var isLoadingH2H = false
    @State private var isLoadingScoring = false
    @State private var isLoadingDraft = false
    @State private var isLoadingPlayoffs = false
    @State private var isLoadingRecords = false
    @State private var h2hError: String?
    @State private var scoringError: String?
    @State private var draftError: String?
    @State private var playoffsError: String?
    @State private var recordsError: String?

    enum SeasonFilter: Hashable {
        case allTime
        case season(Int)

        var displayName: String {
            switch self {
            case .allTime: "All-Time"
            case .season(let year): String(year)
            }
        }

        var yearValue: Int? {
            switch self {
            case .allTime: nil
            case .season(let year): year
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 0) {
                    // Sticky season filter
                    SeasonFilterBar(
                        selectedFilter: $selectedFilter,
                        availableSeasons: leagueStore.activeLeague?.seasons.map { $0.year } ?? []
                    )
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.bottom, Theme.spacingMD)

                    if let errorMessage {
                        ErrorStateView(message: errorMessage) {
                            self.errorMessage = nil
                            Task { await loadStandings() }
                        }
                    }

                    VStack(spacing: Theme.spacingLG) {
                        // League Summary — 2×2 stat grid
                        if !standings.isEmpty || !scoringData.isEmpty {
                            LeagueSummaryGrid(
                                standings: standings,
                                scoringData: scoringData,
                                seasonCount: leagueStore.activeLeague?.seasons.count ?? 0
                            )
                        }

                        // Standings & Rankings (loaded first)
                        AnalyticsSection(
                            title: "Standings & Rankings",
                            icon: "list.number",
                            destination: StandingsDetailView(year: selectedFilter.yearValue),
                            prominence: .featured
                        ) {
                            StandingsPreview(standings: Array(standings.prefix(5)))
                        }

                        // Head-to-Head — loads on appear
                        AnalyticsSectionLoader(
                            isLoading: isLoadingH2H,
                            errorMessage: h2hError,
                            hasData: h2hData != nil,
                            onRetry: { h2hData = nil; Task { await loadH2H() } }
                        ) {
                            if let h2h = h2hData {
                                AnalyticsSection(
                                    title: "Head-to-Head",
                                    icon: "arrow.left.arrow.right",
                                    destination: H2HDetailView(year: selectedFilter.yearValue),
                                    prominence: .featured
                                ) {
                                    H2HPreview(data: h2h)
                                }
                            }
                        }

                        // Scoring Trends
                        AnalyticsSectionLoader(
                            isLoading: isLoadingScoring,
                            errorMessage: scoringError,
                            hasData: !scoringData.isEmpty,
                            onRetry: { scoringData = []; Task { await loadScoring() } }
                        ) {
                            if !scoringData.isEmpty {
                                AnalyticsSection(
                                    title: "Scoring & Trends",
                                    icon: "chart.line.uptrend.xyaxis",
                                    destination: ScoringDetailView(year: selectedFilter.yearValue)
                                ) {
                                    ScoringPreview(data: scoringData)
                                }
                            }
                        }

                        // Draft Analysis
                        AnalyticsSectionLoader(
                            isLoading: isLoadingDraft,
                            errorMessage: draftError,
                            hasData: !draftPicks.isEmpty,
                            onRetry: { draftPicks = []; Task { await loadDraft() } }
                        ) {
                            if !draftPicks.isEmpty {
                                AnalyticsSection(
                                    title: "Draft Analysis",
                                    icon: "list.clipboard",
                                    destination: DraftDetailView(year: selectedFilter.yearValue)
                                ) {
                                    DraftPreview(picks: draftPicks)
                                }
                            }
                        }

                        // Playoff Performance
                        AnalyticsSectionLoader(
                            isLoading: isLoadingPlayoffs,
                            errorMessage: playoffsError,
                            hasData: !playoffs.isEmpty,
                            onRetry: { playoffs = []; Task { await loadPlayoffs() } }
                        ) {
                            if !playoffs.isEmpty {
                                AnalyticsSection(
                                    title: "Playoff Performance",
                                    icon: "flag.checkered",
                                    destination: PlayoffPerformanceView()
                                ) {
                                    PlayoffPreview(data: playoffs)
                                }
                            }
                        }

                        // Records & Milestones
                        AnalyticsSectionLoader(
                            isLoading: isLoadingRecords,
                            errorMessage: recordsError,
                            hasData: records != nil,
                            onRetry: { records = nil; Task { await loadRecords() } }
                        ) {
                            if let records {
                                AnalyticsSection(
                                    title: "Records & Milestones",
                                    icon: "trophy",
                                    destination: RecordsDetailView()
                                ) {
                                    RecordsPreview(data: records)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.bottom, 100)
                }
            }
            .overlay {
                if isLoading && standings.isEmpty {
                    AnalyticsSkeleton()
                }
            }
            .background(Theme.background)
            .navigationTitle("Analytics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task {
                await loadAllAnalytics()
            }
            .onChange(of: selectedFilter) {
                resetSectionData()
                Task { await loadAllAnalytics() }
            }
            .onChange(of: leagueStore.activeLeagueId) {
                resetSectionData()
                Task { await loadAllAnalytics() }
            }
        }
    }

    private func resetSectionData() {
        standings = []
        h2hData = nil
        scoringData = []
        records = nil
        draftPicks = []
        playoffs = []
        h2hError = nil
        scoringError = nil
        draftError = nil
        playoffsError = nil
        recordsError = nil
    }

    private func loadAllAnalytics() async {
        await loadStandings()
        // Load remaining sections in parallel
        async let h2h: () = loadH2H()
        async let scoring: () = loadScoring()
        async let draft: () = loadDraft()
        async let playoff: () = loadPlayoffs()
        async let record: () = loadRecords()
        _ = await (h2h, scoring, draft, playoff, record)
    }

    private func loadStandings() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            standings = try await APIClient.shared.getStandings(leagueId: leagueId, year: selectedFilter.yearValue)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadH2H() async {
        guard let leagueId = leagueStore.activeLeagueId, h2hData == nil else { return }
        h2hError = nil
        isLoadingH2H = true
        defer { isLoadingH2H = false }

        do {
            h2hData = try await APIClient.shared.getH2H(leagueId: leagueId, year: selectedFilter.yearValue)
        } catch {
            h2hError = error.localizedDescription
        }
    }

    private func loadScoring() async {
        guard let leagueId = leagueStore.activeLeagueId, scoringData.isEmpty else { return }
        scoringError = nil
        isLoadingScoring = true
        defer { isLoadingScoring = false }

        do {
            scoringData = try await APIClient.shared.getScoring(leagueId: leagueId, year: selectedFilter.yearValue)
        } catch {
            scoringError = error.localizedDescription
        }
    }

    private func loadDraft() async {
        guard let leagueId = leagueStore.activeLeagueId, draftPicks.isEmpty else { return }
        draftError = nil
        isLoadingDraft = true
        defer { isLoadingDraft = false }

        do {
            draftPicks = try await APIClient.shared.getDraftPicks(leagueId: leagueId, year: selectedFilter.yearValue)
        } catch {
            draftError = error.localizedDescription
        }
    }

    private func loadPlayoffs() async {
        guard let leagueId = leagueStore.activeLeagueId, playoffs.isEmpty else { return }
        playoffsError = nil
        isLoadingPlayoffs = true
        defer { isLoadingPlayoffs = false }

        do {
            playoffs = try await APIClient.shared.getPlayoffs(leagueId: leagueId)
        } catch {
            playoffsError = error.localizedDescription
        }
    }

    private func loadRecords() async {
        guard let leagueId = leagueStore.activeLeagueId, records == nil else { return }
        recordsError = nil
        isLoadingRecords = true
        defer { isLoadingRecords = false }

        do {
            records = try await APIClient.shared.getRecords(leagueId: leagueId)
        } catch {
            recordsError = error.localizedDescription
        }
    }
}

// MARK: - Season Filter Bar

struct SeasonFilterBar: View {
    @Binding var selectedFilter: AnalyticsView.SeasonFilter
    let availableSeasons: [Int]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.spacingSM) {
                FilterChip(
                    label: "All-Time",
                    isSelected: selectedFilter == .allTime
                ) {
                    selectedFilter = .allTime
                }

                ForEach(availableSeasons.sorted(by: >), id: \.self) { year in
                    FilterChip(
                        label: String(year),
                        isSelected: selectedFilter == .season(year)
                    ) {
                        selectedFilter = .season(year)
                    }
                }
            }
        }
    }
}

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(isSelected ? Theme.accent : Theme.card)
                .foregroundStyle(isSelected ? Theme.charcoal : Theme.textSecondary)
                .clipShape(Capsule())
        }
    }
}

// MARK: - Analytics Section Wrapper

enum SectionProminence {
    case featured
    case standard
}

struct AnalyticsSection<Content: View, Destination: View>: View {
    let title: String
    let icon: String
    let destination: Destination
    var prominence: SectionProminence = .standard
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack {
                Image(systemName: icon)
                    .font(prominence == .featured ? .system(size: 16) : .system(size: 14))
                    .foregroundStyle(Theme.accent)
                Text(title.uppercased())
                    .font(prominence == .featured
                        ? .system(size: 13, weight: .bold)
                        : Theme.captionFont)
                    .foregroundStyle(Theme.accent)
                    .textCase(.uppercase)
                    .tracking(1.2)
                Spacer()
                NavigationLink {
                    destination
                } label: {
                    Text("See All")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                }
            }

            if prominence == .featured {
                Rectangle()
                    .fill(Theme.accent.opacity(0.15))
                    .frame(height: 1)
            }

            content()
                .cardStyle()
        }
    }
}

// MARK: - Section Previews

struct StandingsPreview: View {
    let standings: [StandingsEntry]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(standings.enumerated()), id: \.element.id) { index, entry in
                HStack {
                    Text("\(index + 1)")
                        .font(Theme.tabularFont)
                        .foregroundStyle(Theme.dimText)
                        .frame(width: 24)

                    Text(entry.manager.name)
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textPrimary)

                    Spacer()

                    Text("\(entry.wins)-\(entry.losses)")
                        .font(Theme.tabularFont)
                        .foregroundStyle(Theme.textPrimary)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, Theme.spacingMD)

                if index < standings.count - 1 {
                    Divider().background(Theme.surface)
                }
            }
        }
        .padding(.vertical, Theme.spacingSM)
    }
}

struct H2HPreview: View {
    let data: H2HResponse

    var body: some View {
        MiniH2HHeatmap(managers: data.managers, records: data.records)
    }
}

struct ScoringPreview: View {
    let data: [ScoringData]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Mini chart — top 5 scorers avg
            let top5 = data.sorted { $0.avgPoints > $1.avgPoints }.prefix(5)

            Chart(Array(top5)) { entry in
                BarMark(
                    x: .value("Avg", entry.avgPoints),
                    y: .value("Manager", entry.managerName)
                )
                .foregroundStyle(Theme.accent)
            }
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks { value in
                    AxisValueLabel()
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(height: 140)
            .padding(Theme.spacingMD)
        }
    }
}

struct DraftPreview: View {
    let picks: [DraftPickEntry]

    private var grades: [DraftGrade] { Array(calculateDraftGrades(picks: picks).prefix(3)) }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(grades.enumerated()), id: \.element.id) { index, grade in
                HStack {
                    Text("\(index + 1)")
                        .font(Theme.tabularFont)
                        .foregroundStyle(Theme.dimText)
                        .frame(width: 24)

                    Text(grade.managerName)
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textPrimary)

                    Spacer()

                    Text(grade.grade)
                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                        .foregroundStyle(gradeColor(grade.grade))
                }
                .padding(.vertical, 8)
                .padding(.horizontal, Theme.spacingMD)

                if index < grades.count - 1 {
                    Divider().background(Theme.surface)
                }
            }
        }
        .padding(.vertical, Theme.spacingSM)
    }

    private func gradeColor(_ grade: String) -> Color {
        switch grade {
        case "A+", "A": Theme.win
        case "B+", "B": Theme.accent
        case "C+", "C": Theme.tie
        default: Theme.loss
        }
    }
}

// MARK: - League Summary Grid

struct LeagueSummaryGrid: View {
    let standings: [StandingsEntry]
    let scoringData: [ScoringData]
    let seasonCount: Int

    private var totalGames: Int {
        scoringData.reduce(0) { $0 + $1.gamesPlayed }
    }

    private var allTimeHigh: Double {
        scoringData.map(\.maxPoints).max() ?? 0
    }

    private var avgPPG: Double {
        let total = scoringData.reduce(0.0) { $0 + $1.totalPoints }
        let games = scoringData.reduce(0) { $0 + $1.gamesPlayed }
        return games > 0 ? total / Double(games) : 0
    }

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.spacingSM) {
            SummaryCard(value: "\(seasonCount)", label: "Seasons", icon: "calendar")
            SummaryCard(value: "\(totalGames)", label: "Total Games", icon: "sportscourt")
            SummaryCard(value: String(format: "%.1f", allTimeHigh), label: "All-Time High", icon: "flame")
            SummaryCard(value: String(format: "%.1f", avgPPG), label: "Avg PPG", icon: "chart.bar")
        }
    }
}

struct SummaryCard: View {
    let value: String
    let label: String
    let icon: String

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Theme.accent)
            Text(value)
                .font(Theme.statFont)
                .foregroundStyle(Theme.textPrimary)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.dimText)
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}

struct PlayoffPreview: View {
    let data: [PlayoffPerformance]

    private var top3: [PlayoffPerformance] {
        Array(data.filter { $0.playoffGames > 0 }.sorted { $0.clutchRating > $1.clutchRating }.prefix(3))
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(top3.enumerated()), id: \.element.id) { index, entry in
                HStack {
                    Text(entry.managerName)
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textPrimary)

                    Spacer()

                    Text(String(format: "%+.1f", entry.clutchRating))
                        .font(Theme.tabularFont)
                        .foregroundStyle(entry.clutchRating >= 0 ? Theme.win : Theme.loss)

                    Text("\(entry.playoffGames)g")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.dimText)
                        .frame(width: 28, alignment: .trailing)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, Theme.spacingMD)

                if index < top3.count - 1 {
                    Divider().background(Theme.surface)
                }
            }
        }
        .padding(.vertical, Theme.spacingSM)
    }
}

struct RecordsPreview: View {
    let data: RecordsResponse

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Champion history
            if !data.champions.isEmpty {
                ForEach(data.champions.prefix(3), id: \.year) { champ in
                    HStack {
                        Image(systemName: "trophy.fill")
                            .foregroundStyle(Theme.accent)
                            .font(.system(size: 14))

                        Text(verbatim: "\(champ.year)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(Theme.dimText)

                        Text(champ.manager)
                            .font(Theme.bodyFont)
                            .foregroundStyle(Theme.textPrimary)

                        Spacer()
                    }
                    .padding(.vertical, 4)
                    .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
        .padding(.vertical, Theme.spacingSM)
    }
}

// MARK: - Section Loader Wrapper

struct AnalyticsSectionLoader<Content: View>: View {
    let isLoading: Bool
    let errorMessage: String?
    let hasData: Bool
    let onRetry: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        if isLoading && !hasData {
            AnalyticsSectionSkeleton()
        } else if let errorMessage, !hasData {
            VStack(spacing: Theme.spacingSM) {
                Text(errorMessage)
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)

                Button {
                    onRetry()
                } label: {
                    Text("Retry")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(Theme.spacingLG)
            .cardStyle()
        } else {
            content()
        }
    }
}

private struct AnalyticsSectionSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack {
                ShimmerBlock(height: 14, shape: .circle)
                ShimmerBlock(width: 140, height: 12)
                Spacer()
                ShimmerBlock(width: 48, height: 12)
            }

            VStack(spacing: 0) {
                ForEach(0..<3, id: \.self) { index in
                    HStack {
                        ShimmerBlock(width: 24, height: 14)
                        ShimmerBlock(width: 100, height: 14)
                        Spacer()
                        ShimmerBlock(width: 50, height: 14)
                    }
                    .padding(.vertical, Theme.spacingSM)
                    .padding(.horizontal, Theme.spacingMD)

                    if index < 2 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .cardStyle()
        }
    }
}
