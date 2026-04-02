import SwiftUI

struct InsightBannerView: View {
    let insights: [InsightItem]
    @State private var currentIndex = 0
    @State private var timer: Timer?

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            TabView(selection: $currentIndex) {
                ForEach(Array(insights.enumerated()), id: \.element.id) { index, insight in
                    InsightCard(insight: insight)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 120)

            // Page dots
            if insights.count > 1 {
                HStack(spacing: 6) {
                    ForEach(0..<insights.count, id: \.self) { index in
                        Circle()
                            .fill(index == currentIndex ? Theme.accent : Theme.dimText.opacity(0.4))
                            .frame(width: 6, height: 6)
                    }
                }
            }
        }
        .onAppear { startTimer() }
        .onDisappear { stopTimer() }
        .onChange(of: currentIndex) { stopTimer(); startTimer() }
    }

    private func startTimer() {
        guard insights.count > 1 else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 6, repeats: true) { _ in
            withAnimation {
                currentIndex = (currentIndex + 1) % insights.count
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
}

struct InsightCard: View {
    let insight: InsightItem

    var body: some View {
        HStack(spacing: Theme.spacingMD) {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                HStack(spacing: Theme.spacingSM) {
                    Image(systemName: iconForType(insight.type))
                        .font(.system(size: 14))
                        .foregroundStyle(colorForType(insight.type))

                    Text(insight.type.rawValue.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(colorForType(insight.type))
                        .tracking(1.0)
                }

                buildHeadline(insight.headline)

                if let detail = insight.detail {
                    Text(detail)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.dimText)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(spacing: 2) {
                Text(insight.stat)
                    .font(Theme.statFont)
                    .foregroundStyle(Theme.accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(insight.statLabel)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(Theme.dimText)
            }
            .frame(minWidth: 60)
        }
        .padding(Theme.spacingMD)
        .background(Theme.card)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(colorForType(insight.type))
                .frame(width: 2)
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }

    private func buildHeadline(_ text: String) -> some View {
        let parts = text.components(separatedBy: "**")
        var result = Text("")
        for (index, part) in parts.enumerated() {
            if index % 2 == 1 {
                // Bold/accent part
                result = result + Text(part)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Theme.accent)
            } else {
                result = result + Text(part)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(Theme.textPrimary)
            }
        }
        return result.lineLimit(2)
    }

    private func iconForType(_ type: InsightType) -> String {
        switch type {
        case .streak: "flame.fill"
        case .record: "trophy.fill"
        case .consistency: "chart.line.flattrend.xyaxis"
        case .clutch: "bolt.fill"
        case .rivalry: "person.2.fill"
        case .heartbreak: "heart.slash.fill"
        case .dominance: "crown.fill"
        case .history: "clock.arrow.circlepath"
        case .milestone: "flag.checkered"
        case .comparison: "arrow.up.right"
        }
    }

    private func colorForType(_ type: InsightType) -> Color {
        switch type {
        case .streak, .record, .clutch, .dominance: Theme.accent
        case .consistency: .cyan
        case .rivalry, .history: Theme.textSecondary
        case .heartbreak: Theme.loss
        case .milestone, .comparison: Theme.win
        }
    }
}
