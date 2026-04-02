import SwiftUI
import Charts

struct SparklineView: View {
    let scores: [Double]

    private var trend: Double {
        guard scores.count >= 10 else { return 0 }
        let recent = scores.suffix(5).reduce(0, +) / 5
        let earlier = scores.prefix(5).reduce(0, +) / 5
        return recent - earlier
    }

    private var trendColor: Color {
        trend >= 0 ? Theme.win : Theme.loss
    }

    var body: some View {
        Chart(Array(scores.enumerated()), id: \.offset) { index, score in
            LineMark(
                x: .value("Week", index),
                y: .value("Score", score)
            )
            .foregroundStyle(trendColor)
            .lineStyle(StrokeStyle(lineWidth: 1.5))

            AreaMark(
                x: .value("Week", index),
                y: .value("Score", score)
            )
            .foregroundStyle(
                .linearGradient(
                    colors: [
                        trendColor.opacity(0.15),
                        .clear,
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: (scores.min() ?? 0) * 0.9 ... (scores.max() ?? 200) * 1.05)
        .frame(height: 40)
    }
}
