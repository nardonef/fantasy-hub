import SwiftUI

/// A single card in the unified signal stream.
/// Left border is color-coded by source (Decision 017-A).
struct SignalCard: View {
    let signal: Signal

    var body: some View {
        HStack(spacing: 0) {
            // Source color bar
            Rectangle()
                .fill(signal.source.accentColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: Theme.spacingXS) {
                // Top row: player + source badge
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(signal.player.fullName)
                            .font(Theme.titleFont)
                            .foregroundStyle(Theme.textPrimary)

                        HStack(spacing: Theme.spacingXS) {
                            if let pos = signal.player.position {
                                Text(pos)
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(signal.player.positionColor)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(signal.player.positionColor.opacity(0.15))
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                            }
                            if let team = signal.player.nflTeam {
                                Text(team)
                                    .font(Theme.captionFont)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        HStack(spacing: 4) {
                            Image(systemName: signal.signalType.systemIcon)
                                .font(.system(size: 10))
                            Text(signal.source.displayName)
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(signal.source.accentColor)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(signal.source.accentColor.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                        Text(signal.relativeTime)
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }

                // Signal content
                Text(signal.content)
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Theme.spacingMD)
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }
}
