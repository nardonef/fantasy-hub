import SwiftUI

/// A player card showing their most recent signals grouped together.
/// Tapping the whole card navigates to PlayerDetailView.
struct PlayerSignalGroupView: View {
    let player: FeedPlayer
    let signals: [Signal]

    /// Ranking info from the most recent RANKING_CHANGE signal, if present.
    private var rankingInfo: (rank: Int, delta: Int)? {
        guard let s = signals.first(where: { $0.signalType == .rankingChange }),
              let meta = s.metadata,
              let rank = meta.rankEcr else { return nil }
        return (rank, meta.rankDelta ?? 0)
    }

    var body: some View {
        NavigationLink {
            PlayerDetailView(playerId: player.id, playerName: player.fullName)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                playerHeader
                    .padding(Theme.spacingMD)

                if !signals.isEmpty {
                    Rectangle()
                        .fill(Color.white.opacity(0.07))
                        .frame(height: 1)

                    VStack(spacing: 0) {
                        let capped = Array(signals.prefix(3))
                        ForEach(Array(capped.enumerated()), id: \.element.id) { index, signal in
                            RosterSignalRow(signal: signal)
                            if index < capped.count - 1 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.05))
                                    .frame(height: 1)
                            }
                        }
                    }
                }
            }
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .buttonStyle(.plain)
    }

    private var playerHeader: some View {
        HStack(spacing: Theme.spacingSM) {
            ZStack {
                Circle()
                    .fill(player.positionColor.opacity(0.15))
                    .frame(width: 36, height: 36)
                Text(player.position ?? "?")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(player.positionColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(player.fullName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                if let team = player.nflTeam {
                    Text(team)
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textSecondary)
                }
            }

            Spacer()

            if let info = rankingInfo {
                rankBadge(rank: info.rank, delta: info.delta)
            } else {
                signalCountBadge
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textSecondary.opacity(0.4))
        }
    }

    private func rankBadge(rank: Int, delta: Int) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("#\(rank)")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.textPrimary)
            if delta != 0 {
                HStack(spacing: 2) {
                    Image(systemName: delta > 0 ? "arrow.down" : "arrow.up")
                        .font(.system(size: 9, weight: .bold))
                    Text("\(abs(delta))")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                }
                .foregroundStyle(delta > 0 ? Color(hex: 0xF87171) : Color(hex: 0x4ADE80))
            }
        }
    }

    private var signalCountBadge: some View {
        Text("\(signals.count) signal\(signals.count == 1 ? "" : "s")")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Theme.textSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.white.opacity(0.06))
            .clipShape(Capsule())
    }
}

// MARK: - Signal Row

/// Renders a single Signal as a source-colored row. Mirrors PlayerSignalRowView
/// but accepts the Signal type from the intelligence feed instead of PlayerSignal.
private struct RosterSignalRow: View {
    let signal: Signal

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(signal.source.accentColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 6) {
                HStack {
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
                    .clipShape(RoundedRectangle(cornerRadius: 5))

                    Spacer()

                    Text(signal.relativeTime)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.textSecondary)
                }

                Text(signal.content)
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(3)
            }
            .padding(Theme.spacingMD)
        }
    }
}
