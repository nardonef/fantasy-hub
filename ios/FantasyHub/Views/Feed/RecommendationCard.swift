import SwiftUI

/// Confidence-scored recommendation card (Decision 018-B).
/// Shows signal strength as filled dots (1–4 based on distinct source count).
struct RecommendationCard: View {
    let item: RecommendationItem
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Left accent bar — gold for recommendations
                Rectangle()
                    .fill(Theme.accent)
                    .frame(width: 3)

                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    // Top row: player info + confidence meter
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.player.fullName)
                                .font(Theme.titleFont)
                                .foregroundStyle(Theme.textPrimary)

                            HStack(spacing: Theme.spacingXS) {
                                if let pos = item.player.position {
                                    Text(pos)
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(item.player.positionColor)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 2)
                                        .background(item.player.positionColor.opacity(0.15))
                                        .clipShape(RoundedRectangle(cornerRadius: 4))
                                }
                                if let team = item.player.nflTeam {
                                    Text(team)
                                        .font(Theme.captionFont)
                                        .foregroundStyle(Theme.textSecondary)
                                }
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            ConfidenceMeter(level: item.confidence)
                            Text("\(item.signalCount) signal\(item.signalCount == 1 ? "" : "s")")
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }

                    // Latest signal content
                    Text(item.latestSignal.content)
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .lineLimit(2)

                    // Source chips
                    HStack(spacing: 6) {
                        ForEach(item.sources, id: \.self) { sourceRaw in
                            if let source = SignalSource(rawValue: sourceRaw) {
                                Text(source.displayName)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(source.accentColor)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 3)
                                    .background(source.accentColor.opacity(0.12))
                                    .clipShape(RoundedRectangle(cornerRadius: 5))
                            }
                        }
                    }
                }
                .padding(Theme.spacingMD)
            }
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Confidence Meter

/// 4-dot signal strength indicator — filled dots = distinct source count.
struct ConfidenceMeter: View {
    let level: Int  // 1–4

    var body: some View {
        HStack(spacing: 3) {
            ForEach(1...4, id: \.self) { dot in
                Circle()
                    .fill(dot <= level ? Theme.accent : Theme.accent.opacity(0.2))
                    .frame(width: 6, height: 6)
            }
        }
    }
}
