import SwiftUI

/// Player detail sheet — AI summary, signal timeline, numerals strip, and action bar.
struct PlayerDetailView: View {
    let playerId: String
    let playerName: String

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var leagueStore: LeagueStore

    @State private var player: PlayerDetail?
    @State private var aiSummary: PlayerAISummary?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isMuted: Bool = false
    @State private var toastMessage: String?
    @State private var toastVisible = false

    private var toneColor: Color {
        aiSummary?.verdict?.toneColor ?? player?.positionColor ?? Theme.textSecondary
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(spacing: 0) {
                    sheetHandle
                    if isLoading && player == nil {
                        PlayerDetailSkeleton()
                            .padding(.bottom, 100)
                    } else if let error = errorMessage {
                        ErrorStateView(message: error) {
                            errorMessage = nil
                            Task { await load() }
                        }
                        .padding(Theme.spacingLG)
                        .padding(.bottom, 100)
                    } else if let player {
                        headerSection(player)
                        numeralsStrip(player)
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.top, Theme.spacingMD)
                        aiSummarySection
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.top, Theme.spacingMD)
                        signalTimeline(player.signals)
                            .padding(.top, Theme.spacingMD)
                        matchupCard
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.top, Theme.spacingMD)
                            .padding(.bottom, 120)
                    }
                }
            }
            .background(Theme.background)

            actionBar
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .bottom)
        .overlay(alignment: .bottom) {
            if toastVisible, let msg = toastMessage {
                Text(msg)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.background)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Theme.textPrimary)
                    .clipShape(Capsule())
                    .padding(.bottom, 110)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: toastVisible)
        .task { await load() }
        .onAppear {
            let mutedIds = UserDefaults.standard.stringArray(forKey: "mutedPlayerIds") ?? []
            isMuted = mutedIds.contains(playerId)
        }
    }

    // MARK: - Sheet Handle + Close

    private var sheetHandle: some View {
        HStack {
            Text("PLAYER · INTEL")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textSecondary)
                .tracking(1.2)
            Spacer()
            Button("Done") { dismiss() }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.accent)
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.top, 16)
        .padding(.bottom, Theme.spacingSM)
        .overlay(alignment: .top) {
            Capsule()
                .fill(Theme.hairlineStrong)
                .frame(width: 36, height: 4)
                .offset(y: -10)
        }
    }

    // MARK: - Header

    private func headerSection(_ player: PlayerDetail) -> some View {
        ZStack(alignment: .topLeading) {
            Theme.background
            LinearGradient(
                colors: [toneColor.opacity(0.12), Theme.background],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 160)

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 14) {
                    // Team logo plate (position circle as stand-in)
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(player.positionColor.opacity(0.15))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Theme.hairlineStrong, lineWidth: 1)
                            )
                            .frame(width: 56, height: 56)
                        Text(player.position ?? "?")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(player.positionColor)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(player.fullName)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(Theme.textPrimary)

                        HStack(spacing: 4) {
                            if let pos = player.position { Text(pos) }
                            if let team = player.nflTeam { Text("· \(team)") }
                            if let status = player.status, status != "active" {
                                Text("· \(status.uppercased())")
                                    .foregroundStyle(Theme.loss)
                            }
                        }
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textSecondary)
                    }
                }

                HStack(spacing: 8) {
                    if let verdict = aiSummary?.verdict {
                        verdictPill(verdict)
                    }
                    matchupPill
                }
            }
            .padding(18)
        }
    }

    private func verdictPill(_ verdict: TakeawayTag) -> some View {
        Text("AI SAYS \(verdict.rawValue)")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(verdict.toneColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(verdict.toneColor.opacity(0.12))
            .overlay(
                Capsule().stroke(verdict.toneColor.opacity(0.4), lineWidth: 1)
            )
            .clipShape(Capsule())
    }

    private var matchupPill: some View {
        Text("Week 14 · vs SEA")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Theme.textDim)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Theme.bgElev2)
            .overlay(Capsule().stroke(Theme.hairline, lineWidth: 0.5))
            .clipShape(Capsule())
    }

    // MARK: - Numerals Strip

    private func numeralsStrip(_ player: PlayerDetail) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 4), spacing: 1) {
            numCell(caption: "PROJ", value: player.projectedPoints.map { String(format: "%.1f", $0) }, unit: "pts")
            numCell(caption: "RANK", value: nil, unit: nil)
            numCell(caption: "OWN%", value: player.ownershipPct.map { String(format: "%.0f", $0) }, unit: "%")
            numCell(caption: "START%", value: player.startPct.map { String(format: "%.0f", $0) }, unit: "%")
        }
        .background(Theme.bgElev1)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.hairline, lineWidth: 1)
        )
    }

    private func numCell(caption: String, value: String?, unit: String?) -> some View {
        VStack(spacing: 3) {
            Text(caption)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Theme.textFaint)
                .tracking(0.8)
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text(value ?? "—")
                    .font(Theme.numStat)
                    .foregroundStyle(value != nil ? Theme.textPrimary : Theme.textSecondary)
                    .monospacedDigit()
                if let unit, value != nil {
                    Text(unit)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.textDim)
                }
            }
        }
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(Theme.bgElev1)
    }

    // MARK: - AI Summary

    @ViewBuilder
    private var aiSummarySection: some View {
        if let summary = aiSummary {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .padding(4)
                        .background(Theme.accent.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                    Text("AI SUMMARY")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .tracking(1.2)
                }

                Text(summary.body)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textPrimary)
                    .lineSpacing(4)

                HStack(spacing: 8) {
                    ConfidenceDots(n: summary.confidence, tone: toneColor)
                    Text("\(confidenceLabel(summary.confidence)) confidence · \(summary.signalCount) signal\(summary.signalCount == 1 ? "" : "s")")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.textDim)
                }
            }
            .padding(Theme.spacingMD)
            .background(Theme.bgElev1)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusMD)
                    .stroke(Theme.hairlineStrong, lineWidth: 0.5)
            )
        }
    }

    // MARK: - Signal Timeline

    private func signalTimeline(_ signals: [PlayerSignal]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
                Text("SIGNALS · 72H")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(Theme.textSecondary)
                    .tracking(1.0)
            }
            .padding(.horizontal, Theme.spacingMD)
            .padding(.bottom, Theme.spacingSM)

            if signals.isEmpty {
                HStack(spacing: Theme.spacingSM) {
                    Image(systemName: "antenna.radiowaves.left.and.right.slash")
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.textSecondary)
                    Text("No signals in the last 72 hours")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(Theme.spacingMD)
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(Array(signals.enumerated()), id: \.element.id) { index, signal in
                    timelineRow(signal: signal, isLast: index == signals.count - 1)
                }
            }
        }
    }

    private func timelineRow(signal: PlayerSignal, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 0) {
            // Left rail: glyph circle + connector
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(signal.source.accentColor.opacity(0.15))
                        .frame(width: 22, height: 22)
                    Image(systemName: signal.signalType.systemIcon)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(signal.source.accentColor)
                }
                if !isLast {
                    Rectangle()
                        .fill(Theme.hairline)
                        .frame(width: 1)
                        .frame(minHeight: 32)
                }
            }
            .frame(width: 22)
            .padding(.leading, Theme.spacingMD)

            // Right content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(signal.source.displayName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(signal.source.accentColor)
                    Spacer()
                    Text(signal.relativeTime)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.textSecondary)
                        .monospacedDigit()
                }
                Text(signal.content)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.textDim)
                    .italic(signal.source == .twitter || signal.source == .bluesky)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("From \(signal.source.displayName), \(signal.relativeTime). \(signal.content)")
            }
            .padding(.leading, 12)
            .padding(.trailing, Theme.spacingMD)
            .padding(.top, 2)
            .padding(.bottom, isLast ? Theme.spacingMD : Theme.spacingLG)
        }
    }

    // MARK: - Matchup Card

    private var matchupCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("WEEK 14 MATCHUP")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textSecondary)
                .tracking(1.0)

            Text("SF at SEA · Sun 4:25 PM · Lumen Field")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)

            HStack {
                matchupStat(label: "SPREAD", value: "SEA −3")
                Divider().frame(height: 24).background(Theme.hairline)
                matchupStat(label: "O/U", value: "43.5")
                Divider().frame(height: 24).background(Theme.hairline)
                matchupStat(label: "IMP. TOTAL", value: "20.3")
            }
        }
        .padding(Theme.spacingMD)
        .background(Theme.bgElev1)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.hairline, lineWidth: 0.5)
        )
    }

    private func matchupStat(label: String, value: String) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Theme.textFaint)
                .tracking(0.8)
            Text(value)
                .font(Theme.tabularFont)
                .foregroundStyle(Theme.textPrimary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Sticky Action Bar

    private var actionBar: some View {
        HStack(spacing: 8) {
            actionButton(icon: "arrow.2.squarepath", label: "Trade", background: Theme.bgElev2, foreground: Theme.textPrimary) {
                showToast("Trade flow coming soon")
            }
            actionButton(
                icon: isMuted ? "bell.slash.fill" : "bell.slash",
                label: isMuted ? "Unmute" : "Mute",
                background: Theme.bgElev2,
                foreground: Theme.textPrimary
            ) {
                toggleMute()
            }
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.top, 12)
        .padding(.bottom, 30)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.hairline)
                .frame(height: 0.5)
        }
    }

    private func actionButton(icon: String, label: String, background: Color, foreground: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                Text(label)
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(background == Theme.bgElev2 ? Theme.hairline : Color.clear, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Actions

    private func toggleMute() {
        var mutedIds = UserDefaults.standard.stringArray(forKey: "mutedPlayerIds") ?? []
        let lastName = playerName.split(separator: " ").last.map(String.init) ?? playerName
        if isMuted {
            mutedIds.removeAll { $0 == playerId }
            showToast("\(lastName) unmuted")
        } else {
            if !mutedIds.contains(playerId) { mutedIds.append(playerId) }
            showToast("\(lastName) muted for this week")
        }
        UserDefaults.standard.set(mutedIds, forKey: "mutedPlayerIds")
        isMuted.toggle()
    }

    // MARK: - Data Loading

    private func load() async {
        isLoading = true
        let leagueId = leagueStore.activeLeague?.id ?? ""
        async let playerResult = APIClient.shared.getPlayer(playerId: playerId)
        async let summaryResult: PlayerAISummary? = leagueId.isEmpty ? nil : (try? await APIClient.shared.fetchPlayerAISummary(playerId: playerId, leagueId: leagueId))
        do {
            player = try await playerResult
            aiSummary = await summaryResult
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Helpers

    private func showToast(_ message: String) {
        toastMessage = message
        withAnimation { toastVisible = true }
        Task {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            withAnimation { toastVisible = false }
        }
    }

    private func confidenceLabel(_ n: Int) -> String {
        switch n {
        case 0: return "No"
        case 1: return "Low"
        case 2: return "Medium"
        case 3: return "High"
        default: return "Very high"
        }
    }
}

// MARK: - Skeleton

private struct PlayerDetailSkeleton: View {
    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            HStack(spacing: Theme.spacingMD) {
                ShimmerBlock(width: 56, height: 56)
                VStack(alignment: .leading, spacing: 8) {
                    ShimmerBlock(width: 160, height: 20)
                    ShimmerBlock(width: 80, height: 12)
                }
                Spacer()
            }
            .padding(18)

            ShimmerBlock(height: 80)
                .padding(.horizontal, Theme.spacingMD)

            ShimmerBlock(height: 100)
                .padding(.horizontal, Theme.spacingMD)

            VStack(spacing: Theme.spacingSM) {
                ForEach(0..<5, id: \.self) { _ in
                    ShimmerBlock(height: 72)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
    }
}
