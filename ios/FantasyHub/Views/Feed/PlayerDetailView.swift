import SwiftUI

/// Player detail: Stats Hero header + chronological signal feed (Decision 019-A).
struct PlayerDetailView: View {
    let playerId: String
    let playerName: String     // passed from the tapped card for immediate display

    @State private var player: PlayerDetail?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if isLoading && player == nil {
                    PlayerDetailSkeleton()
                } else if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        self.errorMessage = nil
                        Task { await load() }
                    }
                    .padding(Theme.spacingLG)
                } else if let player {
                    // Stats Hero
                    PlayerHeroSection(player: player)

                    // Signal Feed
                    if player.signals.isEmpty {
                        VStack(spacing: Theme.spacingMD) {
                            Image(systemName: "antenna.radiowaves.left.and.right.slash")
                                .font(.system(size: 36))
                                .foregroundStyle(Theme.textSecondary)
                            Text("No signals yet")
                                .font(Theme.bodyFont)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.spacingXL)
                    } else {
                        LazyVStack(spacing: Theme.spacingSM) {
                            ForEach(player.signals) { signal in
                                PlayerSignalRow(signal: signal)
                                    .padding(.horizontal, Theme.spacingMD)
                            }
                        }
                        .padding(.vertical, Theme.spacingMD)
                    }
                }
            }
        }
        .background(Theme.background)
        .navigationTitle(playerName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        do {
            player = try await APIClient.shared.getPlayer(playerId: playerId)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Hero Section

private struct PlayerHeroSection: View {
    let player: PlayerDetail

    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            HStack(spacing: Theme.spacingMD) {
                // Position badge
                ZStack {
                    Circle()
                        .fill(player.positionColor.opacity(0.15))
                        .frame(width: 56, height: 56)
                    Text(player.position ?? "?")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(player.positionColor)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(player.fullName)
                        .font(Theme.headlineFont)
                        .foregroundStyle(Theme.textPrimary)

                    HStack(spacing: Theme.spacingSM) {
                        if let team = player.nflTeam {
                            Label(team, systemImage: "shield.fill")
                                .font(Theme.captionFont)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        if let status = player.status, status != "active" {
                            Text(status.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(Theme.loss)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Theme.loss.opacity(0.15))
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(player.signals.count)")
                        .font(Theme.statFont)
                        .foregroundStyle(Theme.accent)
                    Text("signals")
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(Theme.spacingMD)
            .background(Theme.card)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            Text("Recent Intelligence")
                .font(Theme.captionFont)
                .foregroundStyle(Theme.accent)
                .textCase(.uppercase)
                .tracking(1.2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.spacingMD)
                .padding(.bottom, Theme.spacingXS)
        }
        .background(Theme.surface)
    }
}

// MARK: - Signal Row

private struct PlayerSignalRow: View {
    let signal: PlayerSignal

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
            }
            .padding(Theme.spacingMD)
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }
}

// MARK: - Skeleton

private struct PlayerDetailSkeleton: View {
    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            HStack(spacing: Theme.spacingMD) {
                ShimmerBlock(height: 56, shape: .circle)
                VStack(alignment: .leading, spacing: 8) {
                    ShimmerBlock(width: 160, height: 18)
                    ShimmerBlock(width: 80, height: 12)
                }
                Spacer()
            }
            .padding(Theme.spacingMD)
            .background(Theme.card)

            VStack(spacing: Theme.spacingSM) {
                ForEach(0..<5, id: \.self) { _ in
                    ShimmerBlock(height: 72)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
    }
}
