import SwiftUI
import Charts

struct DraftDetailView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var draftPicks: [DraftPickEntry] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    let year: Int?

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.spacingLG) {
                if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        self.errorMessage = nil
                        Task { await loadData() }
                    }
                } else if !draftPicks.isEmpty {
                    DraftGradesSection(picks: draftPicks)
                    DraftBoardSection(picks: draftPicks)
                }
            }
            .padding(.vertical, Theme.spacingMD)
            .padding(.bottom, 100)
        }
        .overlay {
            if isLoading && draftPicks.isEmpty {
                GenericListSkeleton()
            }
        }
        .background(Theme.background)
        .navigationTitle("Draft Analysis")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: leagueStore.activeLeagueId) {
            draftPicks = []
            errorMessage = nil
            await loadData()
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let raw = try await APIClient.shared.getDraftPicks(leagueId: leagueId, year: year)
            draftPicks = raw
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Draft Grades

struct DraftGrade: Identifiable {
    let id: String
    let managerName: String
    let grade: String
    let gradeScore: Double
    let totalPicks: Int
    let earlyRoundHits: Int // rounds 1-3 picks that performed
    let totalEarlyPicks: Int
}

func calculateDraftGrades(picks: [DraftPickEntry]) -> [DraftGrade] {
    // Group by manager
    let grouped = Dictionary(grouping: picks) { $0.managerId }

    return grouped.map { managerId, managerPicks in
        let managerName = managerPicks.first?.manager.name ?? "Unknown"
        let totalPicks = managerPicks.count
        let earlyPicks = managerPicks.filter { $0.round <= 3 }

        // Simple grade based on pick efficiency
        // In a real app, this would compare draft position to end-of-season performance
        let earlyRoundHits = earlyPicks.count // placeholder
        let hitRate = totalPicks > 0 ? Double(earlyRoundHits) / Double(totalPicks) : 0
        let gradeScore = hitRate * 100

        let grade: String
        switch gradeScore {
        case 80...: grade = "A+"
        case 70..<80: grade = "A"
        case 60..<70: grade = "B+"
        case 50..<60: grade = "B"
        case 40..<50: grade = "C+"
        case 30..<40: grade = "C"
        case 20..<30: grade = "D"
        default: grade = "F"
        }

        return DraftGrade(
            id: managerId,
            managerName: managerName,
            grade: grade,
            gradeScore: gradeScore,
            totalPicks: totalPicks,
            earlyRoundHits: earlyRoundHits,
            totalEarlyPicks: earlyPicks.count
        )
    }
    .sorted { $0.gradeScore > $1.gradeScore }
}

struct DraftGradesSection: View {
    let picks: [DraftPickEntry]

    private var grades: [DraftGrade] { calculateDraftGrades(picks: picks) }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("DRAFT GRADES")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            VStack(spacing: 0) {
                ForEach(Array(grades.enumerated()), id: \.element.id) { index, grade in
                    HStack {
                        Text("\(index + 1)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(Theme.dimText)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(grade.managerName)
                                .font(Theme.titleFont)
                                .foregroundStyle(Theme.textPrimary)
                            Text("\(grade.totalPicks) picks")
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.dimText)
                        }

                        Spacer()

                        Text(grade.grade)
                            .font(.system(size: 24, weight: .bold, design: .monospaced))
                            .foregroundStyle(gradeColor(grade.grade))
                    }
                    .padding(Theme.spacingMD)
                    .rankAccentStyle(rank: index + 1)
                    .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)

                    if index < grades.count - 1 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
        .padding(.horizontal, Theme.spacingMD)
    }

    private func gradeColor(_ grade: String) -> Color {
        switch grade {
        case "A+", "A": Theme.win
        case "B+", "B": Theme.accent
        case "C+", "C": Theme.tie
        default: Theme.loss
        }
    }
}

// MARK: - Draft Board

struct DraftBoardSection: View {
    let picks: [DraftPickEntry]

    private var maxRound: Int { picks.map(\.round).max() ?? 1 }
    private var managers: [String] {
        Array(Set(picks.map(\.manager.name))).sorted()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("DRAFT BOARD")
                .sectionHeaderStyle()
                .padding(.horizontal, Theme.spacingMD)

            ScrollView(.horizontal, showsIndicators: true) {
                VStack(spacing: 2) {
                    // Header
                    HStack(spacing: 2) {
                        Text("Rd")
                            .frame(width: 28)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.dimText)
                        ForEach(managers, id: \.self) { name in
                            Text(String(name.prefix(4)))
                                .frame(width: 70)
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.dimText)
                        }
                    }

                    ForEach(1...maxRound, id: \.self) { round in
                        HStack(spacing: 2) {
                            Text("\(round)")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundStyle(Theme.dimText)
                                .frame(width: 28)

                            ForEach(managers, id: \.self) { managerName in
                                let pick = picks.first {
                                    $0.round == round && $0.manager.name == managerName
                                }
                                VStack(spacing: 1) {
                                    Text(pick?.playerName ?? "—")
                                        .font(.system(size: 9, weight: .medium))
                                        .foregroundStyle(Theme.textPrimary)
                                        .lineLimit(1)
                                    if let pos = pick?.position {
                                        Text(pos)
                                            .font(.system(size: 8, weight: .bold))
                                            .foregroundStyle(positionColor(pos))
                                    }
                                }
                                .frame(width: 70, height: 32)
                                .background(round % 2 == 0 ? Theme.card : Theme.darkSurface)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, Theme.spacingMD)
        }
    }

    private func positionColor(_ position: String) -> Color {
        switch position.uppercased() {
        case "QB": .red
        case "RB": .cyan
        case "WR": Theme.accent
        case "TE": .green
        case "K": .purple
        case "DEF", "D/ST": .orange
        default: Theme.dimText
        }
    }
}
