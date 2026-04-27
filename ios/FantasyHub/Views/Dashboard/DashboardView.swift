import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var standings: [StandingsEntry] = []
    @State private var recentActivity: [ActivityItem] = []
    @State private var dashboardData: DashboardData?
    @State private var myManager: Manager?
    @State private var leagueManagers: [Manager] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var activityPage = 1
    @State private var activityHasMore = false
    @State private var isLoadingMoreActivity = false
    @State private var showClaimSheet = false
    // Phase 2 data
    @State private var insights: [InsightItem] = []
    @State private var recentScores: [Double]? = nil
    @State private var superlatives: [Superlative] = []
    @State private var h2hResponse: H2HResponse?

    var body: some View {
        NavigationStack {
            ScrollView {
                if isLoading && standings.isEmpty {
                    DashboardSkeleton()
                } else {
                    VStack(spacing: Theme.spacingLG) {
                        if let errorMessage {
                            ErrorStateView(message: errorMessage) {
                                self.errorMessage = nil
                                Task { await loadData() }
                            }
                        } else {
                            // League header
                            if let league = leagueStore.activeLeague {
                                LeagueHeaderCard(league: league)
                            }

                            // Personal dashboard or claim banner
                            if let dashboard = dashboardData {
                                // Insight banner
                                if !insights.isEmpty {
                                    InsightBannerView(insights: insights)
                                }

                                // Career stats with sparkline
                                CareerHeroCard(data: dashboard, recentScores: recentScores)

                                // Superlatives
                                if !superlatives.isEmpty {
                                    SuperlativesView(superlatives: superlatives)
                                }

                                // Rival cards
                                if dashboard.bestRival != nil || dashboard.worstRival != nil {
                                    HStack(spacing: Theme.spacingSM) {
                                        if let best = dashboard.bestRival {
                                            RivalCard(title: "Best Rival", rival: best, isBest: true)
                                        }
                                        if let worst = dashboard.worstRival {
                                            RivalCard(title: "Worst Rival", rival: worst, isBest: false)
                                        }
                                    }
                                }

                                // Rank trajectory
                                if !dashboard.rankHistory.isEmpty {
                                    RankTrajectoryChart(rankHistory: dashboard.rankHistory)
                                }
                            } else if myManager == nil {
                                // Claim banner
                                ClaimManagerBanner {
                                    showClaimSheet = true
                                }
                            }

                            // Quick standings — highlight user's row
                            if !standings.isEmpty {
                                QuickStandingsCard(
                                    standings: Array(standings.prefix(5)),
                                    highlightManagerId: myManager?.id
                                )
                            }

                            // Recent Activity Feed
                            if !recentActivity.isEmpty {
                                RecentActivityCard(
                                    activity: recentActivity,
                                    hasMore: activityHasMore,
                                    isLoadingMore: isLoadingMoreActivity,
                                    onLoadMore: {
                                        Task { await loadMoreActivity() }
                                    }
                                )
                            }

                            // Quick stats
                            QuickStatsGrid(
                                standings: standings,
                                league: leagueStore.activeLeague
                            )
                        }
                    }
                    .padding(Theme.spacingMD)
                }
            }
            .background(Theme.background)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    LeagueSwitcher()
                }
            }
            .task(id: leagueStore.activeLeagueId) {
                standings = []
                recentActivity = []
                dashboardData = nil
                myManager = nil
                errorMessage = nil
                activityPage = 1
                insights = []
                recentScores = nil
                superlatives = []
                h2hResponse = nil
                await loadData()
            }
            .sheet(isPresented: $showClaimSheet) {
                ManagerClaimView(managers: leagueManagers) { claimed in
                    myManager = claimed
                    Task { await loadData() }
                }
                .environmentObject(leagueStore)
            }
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        activityPage = 1
        activityHasMore = false

        do {
            async let s = APIClient.shared.getStandings(leagueId: leagueId)
            async let a: PaginatedActivityResponse = APIClient.shared.getRecentActivity(leagueId: leagueId, page: 1, limit: 20)
            async let mgr = APIClient.shared.getMyManager(leagueId: leagueId)
            standings = try await s
            let activityResponse = try await a
            recentActivity = activityResponse.items
            activityHasMore = activityResponse.hasMore
            activityPage = 1
            myManager = try await mgr

            // Load league managers for claim sheet + H2H data for superlatives
            if let h2h = try? await APIClient.shared.getH2H(leagueId: leagueId) {
                h2hResponse = h2h
                leagueManagers = h2h.managers
            }

            // Load dashboard if manager is claimed
            if myManager != nil {
                let dashboard = try? await APIClient.shared.getDashboard(leagueId: leagueId)
                dashboardData = dashboard
                if let managerId = dashboard?.myManagerId {
                    await loadEnrichedData(leagueId: leagueId, managerId: managerId)
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadMoreActivity() async {
        guard let leagueId = leagueStore.activeLeagueId, activityHasMore, !isLoadingMoreActivity else { return }
        isLoadingMoreActivity = true
        defer { isLoadingMoreActivity = false }

        let nextPage = activityPage + 1
        do {
            let response = try await APIClient.shared.getRecentActivity(leagueId: leagueId, page: nextPage, limit: 20)
            recentActivity.append(contentsOf: response.items)
            activityHasMore = response.hasMore
            activityPage = nextPage
        } catch {
            // Silently fail on load-more; user can try again
        }
    }

    private func loadEnrichedData(leagueId: String, managerId: String) async {
        // Phase 2: Load insights, scoring, and extremes in parallel
        async let insightsTask = APIClient.shared.getInsights(leagueId: leagueId)
        async let scoringTask = APIClient.shared.getScoring(leagueId: leagueId, includeWeekly: true)
        async let extremesTask = APIClient.shared.getExtremes(leagueId: leagueId, limit: 10)

        // Insights
        if let fetchedInsights = try? await insightsTask {
            insights = fetchedInsights
        }

        // Sparkline from scoring data
        let scoringData = (try? await scoringTask) ?? []
        if let myScoring = scoringData.first(where: { $0.managerId == managerId }),
           let weekly = myScoring.weeklyScores {
            let sorted = weekly.sorted { ($0.year, $0.week) < ($1.year, $1.week) }
            recentScores = Array(sorted.suffix(20).map(\.score))
        }

        // Extremes for superlatives
        let extremesData = (try? await extremesTask) ?? ExtremesResponse(
            topPerformances: [], bottomPerformances: [], closestGames: [], biggestBlowouts: []
        )

        // Phase 3: Load playoffs and records for superlatives
        async let playoffsTask = APIClient.shared.getPlayoffs(leagueId: leagueId)
        async let recordsTask = APIClient.shared.getRecords(leagueId: leagueId)

        let playoffsData = (try? await playoffsTask) ?? []
        let recordsData = (try? await recordsTask) ?? RecordsResponse(
            highestScores: [], champions: [], allTimeRecords: []
        )

        let h2h = h2hResponse ?? H2HResponse(managers: [], records: [])

        superlatives = SuperlativeEngine.compute(
            myManagerId: managerId,
            scoring: scoringData,
            extremes: extremesData,
            playoffs: playoffsData,
            records: recordsData,
            h2h: h2h,
            standings: standings
        )
    }
}

// MARK: - Claim Manager Banner

struct ClaimManagerBanner: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Theme.spacingSM) {
                Image(systemName: "person.badge.plus")
                    .font(.system(size: 20))
                    .foregroundStyle(Theme.accent)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Claim Your Manager")
                        .font(Theme.titleFont)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Unlock personal career stats and rival analysis")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }
            .padding(Theme.spacingMD)
            .background(Theme.accent.opacity(0.08))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.accent.opacity(0.3), lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
    }
}

// MARK: - League Header

struct LeagueHeaderCard: View {
    let league: League

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack {
                Text(league.name)
                    .font(Theme.headlineFont)
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Text(league.provider.displayName)
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.accent.opacity(0.15))
                    .clipShape(Capsule())
            }

            HStack(spacing: Theme.spacingMD) {
                StatPill(label: "Teams", value: "\(league.teamCount ?? 0)")
                StatPill(label: "Seasons", value: "\(league.seasons.count)")
                if let scoring = league.scoringType {
                    StatPill(label: "Scoring", value: scoring.uppercased())
                }
            }
        }
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}

struct StatPill: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(Theme.tabularFont)
                .foregroundStyle(Theme.textPrimary)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.textSecondary)
        }
    }
}

// MARK: - Quick Standings

struct QuickStandingsCard: View {
    let standings: [StandingsEntry]
    var highlightManagerId: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("STANDINGS")
                .sectionHeaderStyle()

            ForEach(Array(standings.enumerated()), id: \.element.id) { index, entry in
                let isHighlighted = entry.managerId == highlightManagerId

                HStack {
                    Text("\(index + 1)")
                        .font(Theme.tabularFont)
                        .foregroundStyle(isHighlighted ? Theme.accent : Theme.dimText)
                        .frame(width: 24)

                    Text(entry.manager.name)
                        .font(isHighlighted ? Theme.titleFont : Theme.bodyFont)
                        .foregroundStyle(isHighlighted ? Theme.accent : Theme.textPrimary)

                    Spacer()

                    Text("\(entry.wins)-\(entry.losses)")
                        .font(Theme.tabularFont)
                        .foregroundStyle(isHighlighted ? Theme.accent : Theme.textPrimary)

                    Text(String(format: "%.1f", entry.pointsFor))
                        .font(.system(size: 13, weight: .regular, design: .monospaced))
                        .foregroundStyle(Theme.dimText)
                        .frame(width: 60, alignment: .trailing)
                }
                .padding(.vertical, 4)
                .padding(.horizontal, isHighlighted ? Theme.spacingSM : 0)
                .background(isHighlighted ? Theme.accent.opacity(0.08) : .clear)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))

                if index < standings.count - 1 {
                    Divider()
                        .background(Theme.surface)
                }
            }
        }
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}

// MARK: - Recent Activity Feed

struct RecentActivityCard: View {
    let activity: [ActivityItem]
    var hasMore: Bool = false
    var isLoadingMore: Bool = false
    var onLoadMore: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("RECENT ACTIVITY")
                .sectionHeaderStyle()

            VStack(spacing: 0) {
                ForEach(Array(activity.enumerated()), id: \.element.id) { index, item in
                    HStack(spacing: Theme.spacingSM) {
                        Image(systemName: activityIcon(item))
                            .font(.system(size: 16))
                            .foregroundStyle(activityColor(item))
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                                .font(Theme.bodyFont)
                                .foregroundStyle(Theme.textPrimary)
                                .lineLimit(1)

                            HStack(spacing: Theme.spacingSM) {
                                if let manager = item.managerName {
                                    Text(manager)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(Theme.accent)
                                }
                                if let detail = item.detail {
                                    Text(detail)
                                        .font(.system(size: 11))
                                        .foregroundStyle(Theme.dimText)
                                        .lineLimit(1)
                                }
                            }
                        }

                        Spacer()

                        Text(item.relativeTimestamp)
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.dimText)
                    }
                    .padding(Theme.spacingMD)

                    if index < activity.count - 1 {
                        Divider().background(Theme.surface)
                    }
                }

                // Load More button
                if hasMore {
                    Divider().background(Theme.surface)

                    Button {
                        onLoadMore?()
                    } label: {
                        HStack {
                            if isLoadingMore {
                                ProgressView()
                                    .tint(Theme.accent)
                            } else {
                                Text("Load More")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Theme.accent)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(Theme.spacingMD)
                    }
                    .disabled(isLoadingMore)
                }
            }
            .cardStyle()
        }
    }

    private func activityIcon(_ item: ActivityItem) -> String {
        if let icon = item.iconName { return icon }
        switch item.type {
        case .importComplete: return "checkmark.circle.fill"
        case .recordBroken: return "flame.fill"
        case .seasonImported: return "calendar.badge.checkmark"
        case .leagueConnected: return "link.circle.fill"
        case .championCrowned: return "trophy.fill"
        }
    }

    private func activityColor(_ item: ActivityItem) -> Color {
        switch item.type {
        case .importComplete: return Theme.win
        case .recordBroken: return Theme.loss
        case .seasonImported: return .cyan
        case .leagueConnected: return Theme.accent
        case .championCrowned: return Theme.accent
        }
    }
}

// MARK: - Quick Stats

struct QuickStatsGrid: View {
    let standings: [StandingsEntry]
    let league: League?

    private var totalMatchups: Int {
        standings.reduce(0) { $0 + $1.wins + $1.losses + $1.ties } / 2
    }

    private var seasonsImported: Int {
        league?.seasons.count ?? 0
    }

    private var avgScore: Double {
        let totalPF = standings.reduce(0.0) { $0 + $1.pointsFor }
        let totalGames = standings.reduce(0) { $0 + $1.wins + $1.losses + $1.ties }
        return totalGames > 0 ? totalPF / Double(totalGames) : 0
    }

    private var championships: Int {
        standings.filter { $0.finalRank == 1 }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("LEAGUE OVERVIEW")
                .sectionHeaderStyle()

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: Theme.spacingSM) {
                OverviewStatCard(title: "Total Matchups", value: "\(totalMatchups)", icon: "sportscourt")
                OverviewStatCard(title: "Seasons Imported", value: "\(seasonsImported)", icon: "calendar")
                OverviewStatCard(title: "Avg Score", value: avgScore > 0 ? String(format: "%.1f", avgScore) : "—", icon: "chart.line.uptrend.xyaxis")
                OverviewStatCard(title: "Championships", value: "\(championships)", icon: "trophy")
            }
        }
    }
}

struct OverviewStatCard: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Theme.accent)

            Text(value)
                .font(Theme.statFont)
                .foregroundStyle(Theme.textPrimary)

            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}

// MARK: - League Switcher

