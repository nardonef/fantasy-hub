import SwiftUI

// MARK: - Import Stage Model

enum ImportStage: Int, CaseIterable {
    case connecting
    case standings
    case matchups
    case draftPicks
    case crunching
    case done

    var label: String {
        switch self {
        case .connecting: "Connecting..."
        case .standings: "Importing standings..."
        case .matchups: "Importing matchups..."
        case .draftPicks: "Importing draft picks..."
        case .crunching: "Crunching numbers..."
        case .done: "Done!"
        }
    }

    var iconName: String {
        switch self {
        case .connecting: "wifi"
        case .standings: "list.number"
        case .matchups: "sportscourt"
        case .draftPicks: "person.crop.rectangle.stack"
        case .crunching: "chart.bar"
        case .done: "checkmark.seal.fill"
        }
    }
}

// MARK: - Import Progress ViewModel

@MainActor
final class ImportProgressViewModel: ObservableObject {
    @Published var currentStageIndex: Int = -1
    @Published var completedStages: Set<Int> = []
    @Published var isFullyComplete = false
    @Published var showStatsPreview = false

    // Sample stats that animate in after completion
    @Published var statCards: [StatPreviewCard] = [
        StatPreviewCard(title: "Seasons", value: "--", icon: "calendar"),
        StatPreviewCard(title: "Matchups", value: "--", icon: "sportscourt"),
        StatPreviewCard(title: "Draft Picks", value: "--", icon: "person.crop.rectangle.stack"),
    ]

    private var stageTimer: Task<Void, Never>?

    func startImportAnimation() {
        stageTimer = Task {
            for index in ImportStage.allCases.indices {
                guard !Task.isCancelled else { return }

                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                    currentStageIndex = index
                }

                // Simulate stage duration
                let duration: UInt64 = index == ImportStage.allCases.count - 1
                    ? 400_000_000
                    : UInt64.random(in: 600_000_000...1_200_000_000)

                try? await Task.sleep(nanoseconds: duration)
                guard !Task.isCancelled else { return }

                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    completedStages.insert(index)
                }

                // Brief pause before next stage
                try? await Task.sleep(nanoseconds: 200_000_000)
            }

            guard !Task.isCancelled else { return }

            withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) {
                isFullyComplete = true
            }

            // Reveal stat cards with staggered spring animation
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }

            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                showStatsPreview = true
            }
        }
    }

    func updateStatCards(seasons: Int, matchups: Int, picks: Int) {
        statCards = [
            StatPreviewCard(title: "Seasons", value: "\(seasons)", icon: "calendar"),
            StatPreviewCard(title: "Matchups", value: "\(matchups)", icon: "sportscourt"),
            StatPreviewCard(title: "Draft Picks", value: "\(picks)", icon: "person.crop.rectangle.stack"),
        ]
    }

    func cancel() {
        stageTimer?.cancel()
    }
}

struct StatPreviewCard: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let icon: String
}

// MARK: - Import Progress View

struct ImportProgressView: View {
    @StateObject private var viewModel = ImportProgressViewModel()

    var body: some View {
        VStack(spacing: Theme.spacingXL) {
            if viewModel.isFullyComplete {
                completionHeader
            } else {
                progressHeader
            }

            stageList

            if viewModel.showStatsPreview {
                statsPreview
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .onAppear {
            viewModel.startImportAnimation()
        }
        .onDisappear {
            viewModel.cancel()
        }
    }

    // MARK: - Progress Header

    private var progressHeader: some View {
        VStack(spacing: Theme.spacingMD) {
            ZStack {
                Circle()
                    .stroke(Theme.surface, lineWidth: 4)
                    .frame(width: 80, height: 80)

                Circle()
                    .trim(from: 0, to: progressFraction)
                    .stroke(Theme.accent, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .frame(width: 80, height: 80)
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut(duration: 0.4), value: progressFraction)

                Image(systemName: currentStageIcon)
                    .font(.system(size: 28))
                    .foregroundStyle(Theme.accent)
                    .contentTransition(.symbolEffect(.replace))
            }

            Text("Importing Your League")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
        }
    }

    // MARK: - Completion Header

    private var completionHeader: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
                .symbolEffect(.bounce, value: viewModel.isFullyComplete)

            Text("Import Complete!")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)

            Text("Your league history is ready to explore.")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .transition(.scale.combined(with: .opacity))
    }

    // MARK: - Stage List

    private var stageList: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            ForEach(Array(ImportStage.allCases.enumerated()), id: \.offset) { index, stage in
                if index <= viewModel.currentStageIndex {
                    ImportStageRow(
                        stage: stage,
                        isCompleted: viewModel.completedStages.contains(index),
                        isActive: index == viewModel.currentStageIndex && !viewModel.completedStages.contains(index)
                    )
                    .transition(.asymmetric(
                        insertion: .move(edge: .leading).combined(with: .opacity),
                        removal: .opacity
                    ))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.spacingMD)
    }

    // MARK: - Stats Preview

    private var statsPreview: some View {
        VStack(spacing: Theme.spacingSM) {
            Text("AT A GLANCE")
                .sectionHeaderStyle()
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: Theme.spacingSM) {
                ForEach(Array(viewModel.statCards.enumerated()), id: \.element.id) { index, card in
                    StatPreviewCardView(card: card, delay: Double(index) * 0.1)
                }
            }
        }
        .padding(.horizontal, Theme.spacingMD)
    }

    // MARK: - Helpers

    private var progressFraction: CGFloat {
        let total = CGFloat(ImportStage.allCases.count)
        let completed = CGFloat(viewModel.completedStages.count)
        return total > 0 ? completed / total : 0
    }

    private var currentStageIcon: String {
        if viewModel.currentStageIndex >= 0,
           viewModel.currentStageIndex < ImportStage.allCases.count {
            return ImportStage.allCases[viewModel.currentStageIndex].iconName
        }
        return "arrow.triangle.2.circlepath"
    }
}

// MARK: - Import Stage Row

struct ImportStageRow: View {
    let stage: ImportStage
    let isCompleted: Bool
    let isActive: Bool

    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            ZStack {
                if isCompleted {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.positive)
                        .transition(.scale.combined(with: .opacity))
                } else if isActive {
                    ProgressView()
                        .tint(Theme.accent)
                        .scaleEffect(0.8)
                } else {
                    Circle()
                        .fill(Theme.surface)
                        .frame(width: 20, height: 20)
                }
            }
            .frame(width: 24, height: 24)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isCompleted)

            Text(stage.label)
                .font(Theme.bodyFont)
                .foregroundStyle(isCompleted ? Theme.textSecondary : Theme.textPrimary)

            Spacer()
        }
        .padding(.vertical, Theme.spacingXS)
    }
}

// MARK: - Stat Preview Card View

struct StatPreviewCardView: View {
    let card: StatPreviewCard
    let delay: Double
    @State private var appeared = false

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            Image(systemName: card.icon)
                .font(.system(size: 20))
                .foregroundStyle(Theme.accent)

            if card.value == "--" {
                ShimmerBlock(width: 40, height: 28)
            } else {
                Text(card.value)
                    .font(Theme.statFont)
                    .foregroundStyle(Theme.textPrimary)
            }

            Text(card.title)
                .font(Theme.captionFont)
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.spacingMD)
        .cardStyle()
        .scaleEffect(appeared ? 1 : 0.8)
        .opacity(appeared ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7).delay(delay)) {
                appeared = true
            }
        }
    }
}
