import SwiftUI

struct H2HDetailView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var h2hData: H2HResponse?
    @State private var selectedManager: Manager?
    @State private var selectedTab: H2HTab = .heatmap
    @State private var isLoading = true
    @State private var errorMessage: String?

    let year: Int?

    enum H2HTab: String, CaseIterable {
        case heatmap = "Heatmap"
        case breakdown = "Breakdown"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.spacingLG) {
                if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        self.errorMessage = nil
                        Task { await loadData() }
                    }
                } else if let data = h2hData {
                    Picker("View", selection: $selectedTab) {
                        ForEach(H2HTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch selectedTab {
                    case .heatmap:
                        H2HHeatmapView(
                            managers: data.managers,
                            records: data.records
                        )

                    case .breakdown:
                        ManagerSelector(
                            managers: data.managers,
                            selected: $selectedManager
                        )

                        if let manager = selectedManager {
                            ManagerH2HBreakdown(
                                manager: manager,
                                allManagers: data.managers,
                                records: data.records
                            )
                        } else {
                            H2HMatrix(managers: data.managers, records: data.records)
                        }
                    }
                }
            }
            .padding(Theme.spacingMD)
            .padding(.bottom, 100)
        }
        .overlay {
            if isLoading && h2hData == nil {
                GenericListSkeleton()
            }
        }
        .background(Theme.background)
        .navigationTitle("Head-to-Head")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: leagueStore.activeLeagueId) {
            h2hData = nil
            selectedManager = nil
            errorMessage = nil
            await loadData()
        }
    }

    private func loadData() async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            h2hData = try await APIClient.shared.getH2H(leagueId: leagueId, year: year)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Manager Selector

struct ManagerSelector: View {
    let managers: [Manager]
    @Binding var selected: Manager?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack {
                Text("FILTER BY MANAGER")
                    .sectionHeaderStyle()
                Spacer()
                if selected != nil {
                    Button("Show All") { selected = nil }
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(managers) { manager in
                        Button {
                            selected = selected?.id == manager.id ? nil : manager
                        } label: {
                            VStack(spacing: 4) {
                                Circle()
                                    .fill(selected?.id == manager.id ? Theme.accent : Theme.accent.opacity(0.2))
                                    .frame(width: 40, height: 40)
                                    .overlay {
                                        Text(String(manager.name.prefix(1)).uppercased())
                                            .font(.system(size: 16, weight: .bold))
                                            .foregroundStyle(selected?.id == manager.id ? Theme.charcoal : Theme.accent)
                                    }
                                Text(manager.name.split(separator: " ").first.map(String.init) ?? manager.name)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(Theme.textSecondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Single Manager Breakdown

struct ManagerH2HBreakdown: View {
    let manager: Manager
    let allManagers: [Manager]
    let records: [H2HRecord]

    private var managerRecords: [(opponent: Manager, record: H2HRecord)] {
        records
            .filter { $0.managerId == manager.id }
            .compactMap { record in
                guard let opponent = allManagers.first(where: { $0.id == record.opponentId }) else { return nil }
                return (opponent, record)
            }
            .sorted { $0.record.wins > $1.record.wins }
    }

    private var totalWins: Int { managerRecords.reduce(0) { $0 + $1.record.wins } }
    private var totalLosses: Int { managerRecords.reduce(0) { $0 + $1.record.losses } }

    var body: some View {
        VStack(spacing: Theme.spacingLG) {
            // Summary
            VStack(spacing: Theme.spacingSM) {
                Text(manager.name)
                    .font(Theme.headlineFont)
                    .foregroundStyle(Theme.textPrimary)
                Text("vs Everyone: \(totalWins)-\(totalLosses)")
                    .font(Theme.tabularFont)
                    .foregroundStyle(Theme.accent)
            }
            .padding(Theme.spacingMD)
            .frame(maxWidth: .infinity)
            .cardStyle()

            // Individual matchups
            VStack(spacing: 0) {
                ForEach(Array(managerRecords.enumerated()), id: \.element.opponent.id) { index, item in
                    HStack {
                        Text("vs \(item.opponent.name)")
                            .font(Theme.bodyFont)
                            .foregroundStyle(Theme.textPrimary)

                        Spacer()

                        // Win/loss bar
                        let total = max(item.record.wins + item.record.losses, 1)
                        let winPct = CGFloat(item.record.wins) / CGFloat(total)

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
                        .frame(width: 80, height: 8)

                        Text("\(item.record.wins)-\(item.record.losses)")
                            .font(Theme.tabularFont)
                            .foregroundStyle(item.record.wins > item.record.losses ? Theme.win : item.record.wins < item.record.losses ? Theme.loss : Theme.textSecondary)
                            .frame(width: 50, alignment: .trailing)
                    }
                    .padding(Theme.spacingMD)
                    .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)

                    if index < managerRecords.count - 1 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        }
    }
}

// MARK: - Full H2H Matrix (compact)

struct H2HMatrix: View {
    let managers: [Manager]
    let records: [H2HRecord]

    private func record(for managerId: String, vs opponentId: String) -> H2HRecord? {
        records.first { $0.managerId == managerId && $0.opponentId == opponentId }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("ALL MATCHUPS")
                .sectionHeaderStyle()

            ScrollView(.horizontal, showsIndicators: false) {
                VStack(spacing: 2) {
                    // Header row
                    HStack(spacing: 2) {
                        Text("")
                            .frame(width: 80)
                        ForEach(managers) { opponent in
                            Text(String(opponent.name.prefix(3)).uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.dimText)
                                .frame(width: 44)
                        }
                    }

                    // Data rows
                    ForEach(managers) { manager in
                        HStack(spacing: 2) {
                            Text(manager.name.split(separator: " ").first.map(String.init) ?? manager.name)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.textPrimary)
                                .frame(width: 80, alignment: .leading)
                                .lineLimit(1)

                            ForEach(managers) { opponent in
                                if manager.id == opponent.id {
                                    Rectangle()
                                        .fill(Theme.surface)
                                        .frame(width: 44, height: 32)
                                } else if let r = record(for: manager.id, vs: opponent.id) {
                                    Text("\(r.wins)-\(r.losses)")
                                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(r.wins > r.losses ? Theme.win : r.wins < r.losses ? Theme.loss : Theme.textSecondary)
                                        .frame(width: 44, height: 32)
                                        .background(Theme.card)
                                } else {
                                    Text("—")
                                        .font(.system(size: 10))
                                        .foregroundStyle(Theme.dimText)
                                        .frame(width: 44, height: 32)
                                        .background(Theme.card)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
