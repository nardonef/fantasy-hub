import SwiftUI
import Charts

struct ManagerProfileView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var profile: ManagerProfile?
    @State private var isLoading = true

    let managerId: String
    let managerName: String

    var body: some View {
        ScrollView {
            if let profile {
                VStack(spacing: Theme.spacingLG) {
                    // Avatar + Name header
                    ManagerProfileHeader(profile: profile)

                    // Career Stats Grid
                    CareerStatsGrid(profile: profile)

                    // Season-by-Season Results
                    SeasonResultsSection(seasons: profile.seasonResults)

                    // Personal Records
                    PersonalRecordsSection(profile: profile)
                }
                .padding(.horizontal, Theme.spacingMD)
                .padding(.bottom, 100)
            }
        }
        .overlay {
            if isLoading && profile == nil {
                LoadingView(message: "Loading profile...")
            }
        }
        .background(Theme.background)
        .navigationTitle(managerName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: leagueStore.activeLeagueId) {
            profile = nil
            await loadData()
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            profile = try await APIClient.shared.getManagerProfile(
                leagueId: leagueId,
                managerId: managerId
            )
        } catch {
            // Handle error
        }
    }
}

// MARK: - Profile Header

private struct ManagerProfileHeader: View {
    let profile: ManagerProfile

    private var winPct: Double {
        let total = profile.careerRecord.wins + profile.careerRecord.losses + profile.careerRecord.ties
        return total > 0 ? Double(profile.careerRecord.wins) / Double(total) : 0
    }

    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            // Avatar
            Circle()
                .fill(Theme.accent.opacity(0.2))
                .frame(width: 80, height: 80)
                .overlay {
                    Text(String(profile.manager.name.prefix(1)).uppercased())
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(Theme.accent)
                }

            Text(profile.manager.name)
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)

            // Record + Win %
            HStack(spacing: Theme.spacingLG) {
                VStack(spacing: 2) {
                    Text("\(profile.careerRecord.wins)-\(profile.careerRecord.losses)-\(profile.careerRecord.ties)")
                        .font(Theme.statFont)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Career Record")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }

                VStack(spacing: 2) {
                    Text(String(format: "%.1f%%", winPct * 100))
                        .font(Theme.statFont)
                        .foregroundStyle(Theme.accent)
                    Text("Win %")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }
            }
        }
        .padding(Theme.spacingMD)
        .frame(maxWidth: .infinity)
        .cardStyle()
    }
}

// MARK: - Career Stats Grid

private struct CareerStatsGrid: View {
    let profile: ManagerProfile

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("CAREER STATS")
                .sectionHeaderStyle()

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.spacingSM) {
                CareerStatCard(
                    value: "\(profile.seasonsPlayed)",
                    label: "Seasons",
                    icon: "calendar"
                )
                CareerStatCard(
                    value: "\(profile.championships)",
                    label: "Championships",
                    icon: "trophy.fill"
                )
                CareerStatCard(
                    value: "\(profile.playoffAppearances)",
                    label: "Playoff Apps",
                    icon: "flag.fill"
                )
                CareerStatCard(
                    value: String(format: "%.1f", profile.avgPointsPerGame),
                    label: "Avg PPG",
                    icon: "chart.bar.fill"
                )
                CareerStatCard(
                    value: profile.bestFinish.map { "#\($0)" } ?? "--",
                    label: "Best Finish",
                    icon: "arrow.up.circle.fill"
                )
                CareerStatCard(
                    value: profile.worstFinish.map { "#\($0)" } ?? "--",
                    label: "Worst Finish",
                    icon: "arrow.down.circle.fill"
                )
            }
        }
    }
}

private struct CareerStatCard: View {
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

// MARK: - Season Results

private struct SeasonResultsSection: View {
    let seasons: [SeasonResult]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("SEASON BY SEASON")
                .sectionHeaderStyle()

            // Mini points-per-season chart
            if seasons.count > 1 {
                Chart(seasons) { season in
                    BarMark(
                        x: .value("Year", String(season.year)),
                        y: .value("Points", season.pointsFor)
                    )
                    .foregroundStyle(season.isChampion ? Theme.accent.gradient : Theme.dimText.gradient)
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
                    AxisMarks { _ in
                        AxisValueLabel()
                            .foregroundStyle(Theme.dimText)
                    }
                }
                .frame(height: 140)
                .padding(Theme.spacingMD)
                .cardStyle()
            }

            // Table
            ForEach(seasons) { season in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: Theme.spacingSM) {
                            Text(verbatim: "\(season.year)")
                                .font(Theme.tabularFont)
                                .foregroundStyle(Theme.accent)
                            if season.isChampion {
                                Image(systemName: "trophy.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Theme.accent)
                            }
                        }
                        Text(season.teamName)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.dimText)
                    }

                    Spacer()

                    HStack(spacing: Theme.spacingMD) {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text("\(season.wins)-\(season.losses)-\(season.ties)")
                                .font(Theme.tabularFont)
                                .foregroundStyle(Theme.textPrimary)
                            Text("Record")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Theme.dimText)
                        }

                        VStack(alignment: .trailing, spacing: 1) {
                            Text(String(format: "%.1f", season.pointsFor))
                                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                .foregroundStyle(Theme.textSecondary)
                            Text("PF")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Theme.dimText)
                        }

                        if let rank = season.finalRank {
                            VStack(alignment: .trailing, spacing: 1) {
                                Text("#\(rank)")
                                    .font(Theme.tabularFont)
                                    .foregroundStyle(rank <= 3 ? Theme.accent : Theme.textSecondary)
                                Text("Rank")
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(Theme.dimText)
                            }
                        }
                    }
                }
                .padding(Theme.spacingMD)
                .cardStyle()
            }
        }
    }
}

// MARK: - Personal Records

private struct PersonalRecordsSection: View {
    let profile: ManagerProfile

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("PERSONAL RECORDS")
                .sectionHeaderStyle()

            VStack(spacing: 0) {
                if let high = profile.highestScoringWeek {
                    PersonalRecordRow(
                        icon: "flame.fill",
                        iconColor: Theme.win,
                        label: "Highest Score",
                        value: String(format: "%.1f", high.score),
                        detail: "Week \(high.week), \(high.year)"
                    )
                    Divider().background(Theme.surface)
                }

                if let low = profile.lowestScoringWeek {
                    PersonalRecordRow(
                        icon: "arrow.down.circle.fill",
                        iconColor: Theme.loss,
                        label: "Lowest Score",
                        value: String(format: "%.1f", low.score),
                        detail: "Week \(low.week), \(low.year)"
                    )
                    Divider().background(Theme.surface)
                }

                PersonalRecordRow(
                    icon: "chart.bar.fill",
                    iconColor: Theme.accent,
                    label: "Total Points For",
                    value: String(format: "%.0f", profile.careerPointsFor),
                    detail: "\(profile.seasonsPlayed) seasons"
                )
                Divider().background(Theme.surface)

                PersonalRecordRow(
                    icon: "shield.fill",
                    iconColor: .cyan,
                    label: "Total Points Against",
                    value: String(format: "%.0f", profile.careerPointsAgainst),
                    detail: "\(profile.seasonsPlayed) seasons"
                )
            }
            .cardStyle()
        }
    }
}

private struct PersonalRecordRow: View {
    let icon: String
    let iconColor: Color
    let label: String
    let value: String
    let detail: String

    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(iconColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textPrimary)
                Text(detail)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.dimText)
            }

            Spacer()

            Text(value)
                .font(Theme.statFont)
                .foregroundStyle(Theme.textPrimary)
        }
        .padding(Theme.spacingMD)
    }
}
