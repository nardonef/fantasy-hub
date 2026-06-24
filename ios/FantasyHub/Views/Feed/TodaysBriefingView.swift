import SwiftUI

/// Screen 1 — Today's Briefing (Editorial variation).
/// Replaces the ACTION ITEMS section at the top of the My Team tab.
struct TodaysBriefingView: View {
    let briefing: TodaysBriefingResponse?
    let isLoading: Bool

    @State private var selectedTakeaway: BriefingTakeaway?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            sectionEyebrow
                .padding(.horizontal, Theme.spacingMD)

            if isLoading && briefing == nil {
                loadingSkeleton
            } else if let briefing {
                masthead(briefing)
                    .padding(.horizontal, Theme.spacingMD)

                if briefing.takeaways.isEmpty {
                    emptyState
                        .padding(.horizontal, Theme.spacingMD)
                } else {
                    if let lead = briefing.takeaways.first {
                        leadCard(lead)
                            .padding(.horizontal, Theme.spacingMD)
                    }
                    ForEach(Array(briefing.takeaways.dropFirst().prefix(2).enumerated()), id: \.element.id) { offset, t in
                        briefRow(number: offset + 2, takeaway: t)
                            .padding(.horizontal, Theme.spacingMD)
                    }
                }
            } else {
                emptyState
                    .padding(.horizontal, Theme.spacingMD)
            }
        }
        .sheet(item: $selectedTakeaway) { takeaway in
            PlayerDetailView(playerId: takeaway.player.id, playerName: takeaway.player.fullName)
        }
    }

    // MARK: - Eyebrow Header

    private var sectionEyebrow: some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.accent)
            Text("TODAY'S BRIEFING")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.accent)
                .tracking(1.4)
        }
    }

    // MARK: - Masthead (subtitle below eyebrow)

    private func masthead(_ briefing: TodaysBriefingResponse) -> some View {
        Text("Synthesized at \(timeString(briefing.synthesizedAt)) from \(briefing.signalCount) signals across \(briefing.sourceCount) source\(briefing.sourceCount == 1 ? "" : "s").")
            .font(.system(size: 12))
            .foregroundStyle(Theme.textSecondary)
    }

    // MARK: - Lead Card (1st takeaway)

    private func leadCard(_ t: BriefingTakeaway) -> some View {
        ZStack(alignment: .topLeading) {
            // Gradient over elevation surface
            Theme.bgElev1
            LinearGradient(
                colors: [t.tag.toneColor.opacity(0.16), Theme.bgElev1],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(alignment: .leading, spacing: 12) {
                // Top row: tag badge + player info + confidence dots
                HStack(alignment: .center) {
                    TagBadge(tag: t.tag)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.player.fullName)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.textPrimary)
                        if let pos = t.player.position, let team = t.player.nflTeam {
                            Text("\(pos) · \(team)")
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.textDim)
                        }
                    }
                    Spacer()
                    ConfidenceDots(n: t.confidence, tone: t.tag.toneColor)
                }

                // Headline
                Button {
                    selectedTakeaway = t
                } label: {
                    Text(t.headline)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .tracking(-0.3)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)

                // Rationale
                Text(t.rationale)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textDim)
                    .lineSpacing(3)

                // Source chips
                if !t.sources.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(t.sources, id: \.self) { source in
                                SourceChip(source: source)
                            }
                        }
                    }
                }

                // Footer: projected impact (only shown when data is available)
                if let delta = t.projectedDelta {
                    Rectangle()
                        .fill(Theme.hairline)
                        .frame(height: 0.5)

                    HStack(spacing: 6) {
                        Text("PROJECTED IMPACT")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Theme.textFaint)
                            .tracking(1.0)
                        Text(delta)
                            .font(Theme.numStat)
                            .foregroundStyle(t.tag.toneColor)
                            .monospacedDigit()
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusXL))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusXL)
                .stroke(Theme.hairlineStrong, lineWidth: 0.5)
        )
    }

    // MARK: - Brief Row (2nd and 3rd takeaways)

    private func briefRow(number: Int, takeaway t: BriefingTakeaway) -> some View {
        HStack(alignment: .top, spacing: 0) {
            // Left gutter: number + vertical rule
            VStack(spacing: 4) {
                Text("\(number)")
                    .font(.system(size: 26, weight: .semibold, design: .monospaced))
                    .foregroundStyle(t.tag.toneColor)
                    .frame(width: 36)
                Rectangle()
                    .fill(Theme.hairline)
                    .frame(width: 1)
                    .frame(maxHeight: .infinity)
            }
            .padding(.top, 2)

            // Right column
            VStack(alignment: .leading, spacing: 8) {
                // Tag + eyebrow + delta
                HStack {
                    TagBadge(tag: t.tag, outlined: true)
                    if let pos = t.player.position, let team = t.player.nflTeam {
                        Text("\(pos) · \(team)")
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.textDim)
                    }
                    Spacer()
                    if let delta = t.projectedDelta {
                        Text(delta)
                            .font(Theme.numStat)
                            .foregroundStyle(t.tag.toneColor)
                            .monospacedDigit()
                    }
                }

                // Headline
                Button {
                    selectedTakeaway = t
                } label: {
                    Text(t.headline)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)

                // Rationale
                Text(t.rationale)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textDim)
                    .lineLimit(3)

                // Source chips
                HStack(spacing: 6) {
                    ForEach(t.sources.prefix(2), id: \.self) { source in
                        SourceChip(source: source)
                    }
                    if t.sources.count > 2 {
                        Text("+\(t.sources.count - 2) more")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.textFaint)
                    }
                }
            }
            .padding(.leading, 12)
            .padding(.bottom, 16)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack(spacing: Theme.spacingSM) {
                Image(systemName: "checkmark.seal")
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.textSecondary)
                Text("All quiet. No urgent moves for your roster this week.")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(Theme.spacingMD)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.bgElev1)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

            Button("Browse the league feed →") {}
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.accent)
        }
    }

    // MARK: - Loading Skeleton

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            ShimmerBlock(width: 200, height: 13)
                .padding(.horizontal, Theme.spacingMD)
            ShimmerBlock(height: 200)
                .padding(.horizontal, Theme.spacingMD)
            ShimmerBlock(height: 80)
                .padding(.horizontal, Theme.spacingMD)
            ShimmerBlock(height: 80)
                .padding(.horizontal, Theme.spacingMD)
        }
    }

    // MARK: - Helpers

    private func timeString(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "h:mma"
        return fmt.string(from: date).lowercased()
    }
}

// MARK: - Tag Badge

private struct TagBadge: View {
    let tag: TakeawayTag
    var outlined: Bool = false

    var body: some View {
        Text(tag.rawValue)
            .font(.system(size: 10, weight: .heavy))
            .foregroundStyle(outlined ? tag.toneColor : Color(hex: 0x1A1A1A))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(outlined ? tag.toneColor.opacity(0.12) : tag.toneColor)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(outlined ? tag.toneColor.opacity(0.4) : Color.clear, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}
