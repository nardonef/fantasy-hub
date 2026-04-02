import SwiftUI
import Charts

struct RankTrajectoryChart: View {
    let rankHistory: [RankHistoryEntry]

    private var maxRank: Int {
        (rankHistory.map(\.rank).max() ?? 12) + 1
    }

    /// Years to show on the x-axis — thin to every other year for 8+ seasons
    private var visibleYears: Set<Int> {
        let years = rankHistory.map(\.year).sorted()
        if years.count < 8 { return Set(years) }
        // Always show first and last; show every other year in between
        var visible: Set<Int> = [years.first!, years.last!]
        for (i, year) in years.enumerated() where i % 2 == 0 {
            visible.insert(year)
        }
        return visible
    }

    private func shortYear(_ year: Int) -> String {
        "'\(String(format: "%02d", year % 100))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("RANK TRAJECTORY")
                .sectionHeaderStyle()

            if rankHistory.isEmpty {
                Text("No rank data available")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.dimText)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(Theme.spacingLG)
            } else {
                // Negate ranks so rank 1 appears at top (highest y value)
                Chart(rankHistory) { entry in
                    LineMark(
                        x: .value("Season", shortYear(entry.year)),
                        y: .value("Rank", -entry.rank)
                    )
                    .foregroundStyle(Theme.accent)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                    .symbol(Circle())
                    .symbolSize(40)

                    PointMark(
                        x: .value("Season", shortYear(entry.year)),
                        y: .value("Rank", -entry.rank)
                    )
                    .foregroundStyle(entry.rank == 1 ? Theme.accent : Theme.textSecondary)
                    .symbolSize(entry.rank == 1 ? 80 : 40)
                    .annotation(position: entry.rank == 1 ? .top : .bottom, spacing: 4) {
                        if entry.rank <= 3 {
                            Text("#\(entry.rank)")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(entry.rank == 1 ? Theme.accent : Theme.dimText)
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(values: Array(stride(from: -maxRank, through: -1, by: max(1, maxRank / 5)))) { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            .foregroundStyle(Theme.surface)
                        AxisValueLabel {
                            if let intVal = value.as(Int.self) {
                                Text("#\(-intVal)")
                                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                                    .foregroundStyle(Theme.dimText)
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        if let label = value.as(String.self),
                           let yearNum = Int(label.replacingOccurrences(of: "'", with: "")),
                           visibleYears.contains(2000 + yearNum) {
                            AxisValueLabel()
                                .font(.system(size: 10, weight: .medium, design: .monospaced))
                                .foregroundStyle(Theme.dimText)
                        }
                    }
                }
                .frame(height: 180)
                .padding(Theme.spacingMD)
            }
        }
        .cardStyle()
    }
}
