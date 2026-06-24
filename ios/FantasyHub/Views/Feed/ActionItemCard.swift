import SwiftUI

/// Compact tappable row for an IntelligenceCard in the Action Items section.
/// Tapping navigates to IntelCardDetailView which shows the full context + raw signals.
struct ActionItemCard: View {
    let card: IntelligenceCard

    var body: some View {
        HStack(spacing: 0) {
            // Type accent bar
            Rectangle()
                .fill(card.type.accentColor)
                .frame(width: 3)

            HStack(spacing: Theme.spacingSM) {
                // Type icon
                Image(systemName: card.type.systemIcon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(card.type.accentColor)
                    .frame(width: 20)

                // Headline + player names
                VStack(alignment: .leading, spacing: 3) {
                    Text(card.headline)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)

                    if !card.players.isEmpty {
                        Text(card.players.map { $0.fullName }.joined(separator: " · "))
                            .font(Theme.captionFont)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Confidence dots + chevron
                HStack(spacing: 6) {
                    HStack(spacing: 3) {
                        ForEach(1...4, id: \.self) { i in
                            Circle()
                                .fill(i <= card.confidence
                                    ? card.type.accentColor
                                    : card.type.accentColor.opacity(0.2))
                                .frame(width: 5, height: 5)
                        }
                    }
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.textSecondary.opacity(0.5))
                }
            }
            .padding(.horizontal, Theme.spacingMD)
            .padding(.vertical, Theme.spacingMD)
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }
}
