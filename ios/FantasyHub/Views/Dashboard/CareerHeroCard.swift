import SwiftUI

struct CareerHeroCard: View {
    let data: DashboardData
    var recentScores: [Double]? = nil

    private var totalGames: Int {
        data.allTimeRecord.wins + data.allTimeRecord.losses + data.allTimeRecord.ties
    }

    private var winPct: Double {
        totalGames > 0 ? Double(data.allTimeRecord.wins) / Double(totalGames) : 0
    }

    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            // Record
            HStack(spacing: Theme.spacingLG) {
                VStack(spacing: 2) {
                    Text("\(data.allTimeRecord.wins)-\(data.allTimeRecord.losses)-\(data.allTimeRecord.ties)")
                        .font(Theme.statFont)
                        .foregroundStyle(Theme.textPrimary)
                    Text("All-Time Record")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }

                VStack(spacing: 2) {
                    Text(String(format: "%.0f%%", winPct * 100))
                        .font(Theme.statFont)
                        .foregroundStyle(Theme.winRateColor(winPct))
                    Text("Win Rate")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }
            }

            // Trophies + Playoffs
            HStack(spacing: Theme.spacingXL) {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(0..<data.championships, id: \.self) { _ in
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.accent)
                    }
                    if data.championships == 0 {
                        Image(systemName: "trophy")
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.dimText)
                    }
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(data.championships)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(data.championships > 0 ? Theme.accent : Theme.dimText)
                        Text("Championships")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(Theme.dimText)
                    }
                }

                VStack(spacing: 1) {
                    Text("\(data.playoffAppearances)")
                        .font(Theme.tabularFont)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Playoff Apps")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }
            }

            // PPG comparison
            HStack(spacing: Theme.spacingLG) {
                VStack(spacing: 2) {
                    Text(String(format: "%.1f", data.myAvgPpg))
                        .font(Theme.statFont)
                        .foregroundStyle(data.myAvgPpg >= data.leagueAvgPpg ? Theme.win : Theme.loss)
                    Text("Your PPG")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }

                VStack(spacing: 2) {
                    Text(String(format: "%.1f", data.leagueAvgPpg))
                        .font(Theme.tabularFont)
                        .foregroundStyle(Theme.textSecondary)
                    Text("League Avg")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }

                VStack(spacing: 2) {
                    let diff = data.myAvgPpg - data.leagueAvgPpg
                    Text(String(format: "%+.1f", diff))
                        .font(Theme.tabularFont)
                        .foregroundStyle(diff >= 0 ? Theme.win : Theme.loss)
                    Text("vs Avg")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }
            }
            // Sparkline
            if let scores = recentScores, scores.count >= 5 {
                VStack(spacing: 2) {
                    SparklineView(scores: scores)
                    Text("Last \(scores.count) weeks")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}
