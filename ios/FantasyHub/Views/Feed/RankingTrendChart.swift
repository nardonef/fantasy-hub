import SwiftUI
import Charts

/// Line chart of a player's ECR ranking over time.
/// Y-axis is inverted (rank 1 at top). Each `SignalSource` gets its own line,
/// making it straightforward to add additional ranking providers later.
struct RankingTrendChart: View {
    let points: [RankHistoryPoint]

    private var sources: [SignalSource] {
        var seen: [SignalSource] = []
        for p in points where !seen.contains(p.source) {
            seen.append(p.source)
        }
        return seen.sorted { $0.rawValue < $1.rawValue }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            headerRow
            trendChart
        }
        .padding(Theme.spacingMD)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }

    private var headerRow: some View {
        HStack {
            Text("RANKING TREND")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            if sources.count > 1 {
                legendView
            }
        }
    }

    private var trendChart: some View {
        Chart(content: chartContent)
            .chartYScale(domain: .automatic(includesZero: false))
            .chartYAxis { yAxisContent }
            .chartXAxis { xAxisContent }
            .frame(height: 160)
    }

    @ChartContentBuilder
    private func chartContent() -> some ChartContent {
        ForEach(sources, id: \.rawValue) { source in
            sourceMarks(for: source)
        }
    }

    @ChartContentBuilder
    private func sourceMarks(for source: SignalSource) -> some ChartContent {
        let sourcePoints = points.filter { $0.source == source }
        ForEach(sourcePoints) { point in
            // Negate rank so rank #1 appears at top (inverted axis without reversed: API)
            LineMark(
                x: .value("Date", point.date),
                y: .value("Rank", -point.overallRank),
                series: .value("Source", source.displayName)
            )
            .foregroundStyle(source.accentColor)
            .interpolationMethod(.catmullRom)

            PointMark(
                x: .value("Date", point.date),
                y: .value("Rank", -point.overallRank)
            )
            .foregroundStyle(source.accentColor)
            .symbolSize(30)
        }
    }

    @AxisContentBuilder
    private var yAxisContent: some AxisContent {
        AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { value in
            AxisGridLine()
                .foregroundStyle(Color.white.opacity(0.08))
            AxisValueLabel {
                // Show positive rank label (negate back)
                if let v = value.as(Int.self) {
                    Text("\(-v)")
                        .foregroundStyle(Theme.textSecondary)
                        .font(.system(size: 10))
                }
            }
        }
    }

    @AxisContentBuilder
    private var xAxisContent: some AxisContent {
        AxisMarks(values: .automatic(desiredCount: 4)) { _ in
            AxisGridLine()
                .foregroundStyle(Color.white.opacity(0.08))
            AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                .foregroundStyle(Theme.textSecondary)
                .font(.system(size: 10))
        }
    }

    private var legendView: some View {
        HStack(spacing: Theme.spacingSM) {
            ForEach(sources, id: \.rawValue) { source in
                HStack(spacing: 4) {
                    Circle()
                        .fill(source.accentColor)
                        .frame(width: 7, height: 7)
                    Text(source.displayName)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(source.accentColor)
                }
            }
        }
    }
}

// MARK: - Empty / Loading States

struct RankingTrendChartSkeleton: View {
    var body: some View {
        ShimmerBlock(height: 196)
    }
}

struct RankingTrendChartEmpty: View {
    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 16))
                .foregroundStyle(Theme.textSecondary)
            Text("No ranking history available yet")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(Theme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }
}
