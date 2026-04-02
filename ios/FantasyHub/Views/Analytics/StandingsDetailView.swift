import SwiftUI
import Charts

struct StandingsDetailView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var standings: [StandingsEntry] = []
    @State private var powerRankings: [PowerRanking] = []
    @State private var selectedView: StandingsTab = .standings
    @State private var isLoading = true
    @State private var errorMessage: String?

    let year: Int?

    enum StandingsTab: String, CaseIterable {
        case standings = "Standings"
        case power = "Power Rankings"
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
                    // Tab picker
                    Picker("View", selection: $selectedView) {
                        ForEach(StandingsTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, Theme.spacingMD)

                    switch selectedView {
                    case .standings:
                        StandingsTable(standings: standings)
                    case .power:
                        PowerRankingsView(rankings: powerRankings)
                    }
                }
            }
            .padding(.vertical, Theme.spacingMD)
            .padding(.bottom, 100)
        }
        .overlay {
            if isLoading && standings.isEmpty {
                StandingsSkeleton()
            }
        }
        .background(Theme.background)
        .navigationTitle("Standings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: leagueStore.activeLeagueId) {
            standings = []
            powerRankings = []
            errorMessage = nil
            await loadData()
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            standings = try await APIClient.shared.getStandings(leagueId: leagueId, year: year)
            let scoring = try await APIClient.shared.getScoring(leagueId: leagueId, year: year)
            powerRankings = calculatePowerRankings(standings: standings, scoring: scoring)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Full Standings Table

struct StandingsTable: View {
    let standings: [StandingsEntry]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("#")
                    .frame(width: 28, alignment: .leading)
                Text("Manager")
                Spacer()
                Text("W-L-T")
                    .frame(width: 60, alignment: .trailing)
                Text("PF")
                    .frame(width: 65, alignment: .trailing)
                Text("PA")
                    .frame(width: 65, alignment: .trailing)
            }
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.dimText)
            .textCase(.uppercase)
            .padding(.horizontal, Theme.spacingMD)
            .padding(.vertical, Theme.spacingSM)

            ForEach(Array(standings.enumerated()), id: \.element.id) { index, entry in
                HStack(spacing: 0) {
                    // Rank accent bar
                    if index == 0 {
                        Rectangle()
                            .fill(Theme.accent)
                            .frame(width: 4)
                    }

                    HStack {
                        Text("\(index + 1)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(index == 0 ? Theme.accent : Theme.dimText)
                            .frame(width: 28, alignment: .leading)

                        HStack(spacing: 8) {
                            Circle()
                                .fill(index == 0 ? Theme.accent.opacity(0.3) : Theme.accent.opacity(0.2))
                                .frame(width: 28, height: 28)
                                .overlay {
                                    Text(String(entry.manager.name.prefix(1)).uppercased())
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(Theme.accent)
                                }
                            Text(entry.manager.name)
                                .font(Theme.bodyFont)
                                .foregroundStyle(Theme.textPrimary)
                                .lineLimit(1)
                        }

                        Spacer()

                        Text("\(entry.wins)-\(entry.losses)-\(entry.ties)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(entry.wins > entry.losses ? Theme.win : entry.wins < entry.losses ? Theme.loss : Theme.textSecondary)
                            .frame(width: 60, alignment: .trailing)

                        Text(String(format: "%.1f", entry.pointsFor))
                            .font(.system(size: 13, weight: .medium, design: .monospaced))
                            .foregroundStyle(Theme.textSecondary)
                            .frame(width: 65, alignment: .trailing)

                        Text(String(format: "%.1f", entry.pointsAgainst))
                            .font(.system(size: 13, weight: .medium, design: .monospaced))
                            .foregroundStyle(Theme.textSecondary)
                            .frame(width: 65, alignment: .trailing)
                    }
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.vertical, 10)
                }
                .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)

                if entry.madePlayoffs && !(standings.indices.contains(index + 1) && standings[index + 1].madePlayoffs) {
                    Rectangle()
                        .fill(Theme.accent.opacity(0.3))
                        .frame(height: 1)
                        .overlay(alignment: .trailing) {
                            Text("PLAYOFF LINE")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.accent)
                                .padding(.trailing, Theme.spacingMD)
                        }
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }
}

// MARK: - Power Rankings

struct PowerRanking: Identifiable {
    let id: String
    let managerName: String
    let score: Double
    let record: String
    let avgPoints: Double
    let consistency: Double
    let strengthOfSchedule: Double
}

func calculatePowerRankings(standings: [StandingsEntry], scoring: [ScoringData]) -> [PowerRanking] {
    let scoringMap = Dictionary(uniqueKeysWithValues: scoring.map { ($0.managerId, $0) })

    return standings.compactMap { entry -> PowerRanking? in
        let scoringData = scoringMap[entry.managerId]
        let totalGames = max(entry.wins + entry.losses + entry.ties, 1)
        let winPct = Double(entry.wins) / Double(totalGames)
        let avgPts = scoringData?.avgPoints ?? 0
        let consistency = scoringData?.consistency ?? 0
        // Normalize: higher avg points = better, lower consistency (stddev) = better
        let maxAvg = scoring.map(\.avgPoints).max() ?? 1
        let maxConsistency = scoring.map(\.consistency).max() ?? 1

        let normalizedAvg = avgPts / max(maxAvg, 1)
        let normalizedConsistency = 1.0 - (consistency / max(maxConsistency, 1))

        // Power score: 40% win%, 35% scoring avg, 25% consistency
        let powerScore = (winPct * 0.40) + (normalizedAvg * 0.35) + (normalizedConsistency * 0.25)

        return PowerRanking(
            id: entry.managerId,
            managerName: entry.manager.name,
            score: powerScore * 100,
            record: "\(entry.wins)-\(entry.losses)",
            avgPoints: avgPts,
            consistency: consistency,
            strengthOfSchedule: entry.pointsAgainst / Double(totalGames)
        )
    }
    .sorted { $0.score > $1.score }
}

struct PowerRankingsView: View {
    let rankings: [PowerRanking]

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            ForEach(Array(rankings.enumerated()), id: \.element.id) { index, ranking in
                HStack(spacing: Theme.spacingSM) {
                    Text("\(index + 1)")
                        .font(Theme.statFont)
                        .foregroundStyle(index < 3 ? Theme.accent : Theme.dimText)
                        .frame(width: 36)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(ranking.managerName)
                            .font(Theme.titleFont)
                            .foregroundStyle(Theme.textPrimary)

                        HStack(spacing: Theme.spacingMD) {
                            MiniStat(label: "Record", value: ranking.record)
                            MiniStat(label: "Avg Pts", value: String(format: "%.1f", ranking.avgPoints))
                            MiniStat(label: "Consistency", value: String(format: "%.1f", ranking.consistency))
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(String(format: "%.1f", ranking.score))
                            .font(Theme.statFont)
                            .foregroundStyle(Theme.accent)
                        Text("PWR")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.dimText)
                    }
                }
                .padding(Theme.spacingMD)
                .cardStyle()
            }
        }
        .padding(.horizontal, Theme.spacingMD)
    }
}

struct MiniStat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(Theme.textPrimary)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(Theme.dimText)
        }
    }
}
