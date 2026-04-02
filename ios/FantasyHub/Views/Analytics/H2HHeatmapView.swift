import SwiftUI

struct H2HHeatmapView: View {
    let managers: [Manager]
    let records: [H2HRecord]

    @State private var selectedCell: (manager: Manager, opponent: Manager)?

    private func record(for managerId: String, vs opponentId: String) -> H2HRecord? {
        records.first { $0.managerId == managerId && $0.opponentId == opponentId }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    private let cellSize: CGFloat = 44
    private let headerWidth: CGFloat = 44

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            ScrollView([.horizontal, .vertical], showsIndicators: true) {
                VStack(spacing: 0) {
                    // Column headers
                    HStack(spacing: 0) {
                        Color.clear
                            .frame(width: headerWidth, height: headerWidth)

                        ForEach(managers) { opponent in
                            Text(initials(opponent.name))
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(Theme.dimText)
                                .frame(width: cellSize, height: headerWidth)
                        }
                    }

                    // Data rows
                    ForEach(managers) { manager in
                        HStack(spacing: 0) {
                            // Row header
                            Text(initials(manager.name))
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(Theme.dimText)
                                .frame(width: headerWidth, height: cellSize)

                            ForEach(managers) { opponent in
                                if manager.id == opponent.id {
                                    // Diagonal
                                    Rectangle()
                                        .fill(Theme.heatmapEmpty)
                                        .frame(width: cellSize, height: cellSize)
                                } else if let r = record(for: manager.id, vs: opponent.id) {
                                    let totalGames = r.wins + r.losses
                                    let winPct = totalGames > 0 ? Double(r.wins) / Double(totalGames) : 0.5
                                    let isSelected = selectedCell?.manager.id == manager.id
                                        && selectedCell?.opponent.id == opponent.id

                                    Button {
                                        if isSelected {
                                            selectedCell = nil
                                        } else {
                                            selectedCell = (manager, opponent)
                                        }
                                    } label: {
                                        Text("\(r.wins)-\(r.losses)")
                                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                            .foregroundStyle(.white)
                                            .frame(width: cellSize, height: cellSize)
                                            .background(Theme.winRateColor(winPct))
                                            .overlay {
                                                if isSelected {
                                                    RoundedRectangle(cornerRadius: 2)
                                                        .stroke(Theme.accent, lineWidth: 2)
                                                }
                                            }
                                    }
                                } else {
                                    Text("--")
                                        .font(.system(size: 10))
                                        .foregroundStyle(Theme.dimText)
                                        .frame(width: cellSize, height: cellSize)
                                        .background(Theme.card)
                                }
                            }
                        }
                    }
                }
            }

            // Selected cell detail card
            if let selected = selectedCell,
               let r = record(for: selected.manager.id, vs: selected.opponent.id) {
                HeatmapDetailCard(
                    manager: selected.manager,
                    opponent: selected.opponent,
                    record: r
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: selectedCell?.manager.id)
    }
}

// MARK: - Detail Card

private struct HeatmapDetailCard: View {
    let manager: Manager
    let opponent: Manager
    let record: H2HRecord

    private var totalGames: Int { record.wins + record.losses + record.ties }
    private var winPct: Double {
        let played = record.wins + record.losses
        return played > 0 ? Double(record.wins) / Double(played) : 0
    }

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            HStack {
                Text(manager.name)
                    .font(Theme.titleFont)
                    .foregroundStyle(Theme.textPrimary)

                Spacer()

                Text("vs")
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.dimText)

                Spacer()

                Text(opponent.name)
                    .font(Theme.titleFont)
                    .foregroundStyle(Theme.textSecondary)
            }

            HStack(spacing: Theme.spacingLG) {
                VStack(spacing: 2) {
                    Text("\(record.wins)-\(record.losses)")
                        .font(Theme.statFont)
                        .foregroundStyle(record.wins > record.losses ? Theme.win : record.wins < record.losses ? Theme.loss : Theme.textSecondary)
                    Text("Record")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }

                if record.ties > 0 {
                    VStack(spacing: 2) {
                        Text("\(record.ties)")
                            .font(Theme.statFont)
                            .foregroundStyle(Theme.tie)
                        Text("Ties")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(Theme.dimText)
                    }
                }

                VStack(spacing: 2) {
                    Text(String(format: "%.0f%%", winPct * 100))
                        .font(Theme.statFont)
                        .foregroundStyle(Theme.winRateColor(winPct))
                    Text("Win %")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }

                VStack(spacing: 2) {
                    Text(String(format: "%.1f", totalGames > 0 ? record.pointsFor / Double(totalGames) : 0))
                        .font(Theme.tabularFont)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Avg PF")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }

                VStack(spacing: 2) {
                    Text(String(format: "%.1f", totalGames > 0 ? record.pointsAgainst / Double(totalGames) : 0))
                        .font(Theme.tabularFont)
                        .foregroundStyle(Theme.textSecondary)
                    Text("Avg PA")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.dimText)
                }
            }

            // Win/loss bar
            GeometryReader { geo in
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Theme.win)
                        .frame(width: geo.size.width * winPct)
                    Rectangle()
                        .fill(Theme.loss)
                }
                .clipShape(Capsule())
            }
            .frame(height: 6)
        }
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}

// MARK: - Mini Heatmap (for AnalyticsView preview)

struct MiniH2HHeatmap: View {
    let managers: [Manager]
    let records: [H2HRecord]

    private let cellSize: CGFloat = 24
    private let maxManagers = 5

    private var displayManagers: [Manager] {
        Array(managers.prefix(maxManagers))
    }

    private func record(for managerId: String, vs opponentId: String) -> H2HRecord? {
        records.first { $0.managerId == managerId && $0.opponentId == opponentId }
    }

    private func initials(_ name: String) -> String {
        String(name.prefix(1)).uppercased()
    }

    var body: some View {
        VStack(spacing: 0) {
            // Column headers
            HStack(spacing: 0) {
                Color.clear
                    .frame(width: 28, height: cellSize)

                ForEach(displayManagers) { m in
                    Text(initials(m.name))
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Theme.dimText)
                        .frame(width: cellSize, height: cellSize)
                }
            }

            ForEach(displayManagers) { manager in
                HStack(spacing: 0) {
                    Text(initials(manager.name))
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Theme.dimText)
                        .frame(width: 28, height: cellSize)

                    ForEach(displayManagers) { opponent in
                        if manager.id == opponent.id {
                            Rectangle()
                                .fill(Theme.heatmapEmpty)
                                .frame(width: cellSize, height: cellSize)
                        } else if let r = record(for: manager.id, vs: opponent.id) {
                            let totalGames = r.wins + r.losses
                            let winPct = totalGames > 0 ? Double(r.wins) / Double(totalGames) : 0.5

                            Rectangle()
                                .fill(Theme.winRateColor(winPct))
                                .frame(width: cellSize, height: cellSize)
                        } else {
                            Rectangle()
                                .fill(Theme.card)
                                .frame(width: cellSize, height: cellSize)
                        }
                    }
                }
            }
        }
        .padding(Theme.spacingMD)
    }
}
