import SwiftUI

struct PlayerSearchView: View {
    @State private var query = ""
    @State private var results: [PlayerSearchResult] = []
    @State private var isSearching = false
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack(spacing: Theme.spacingSM) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Theme.textSecondary)
                TextField("Search players...", text: $query)
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textPrimary)
                    .focused($isFocused)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.words)
                if !query.isEmpty {
                    Button {
                        query = ""
                        results = []
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(Theme.spacingMD)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            .padding(Theme.spacingMD)
            .background(Theme.surface)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            // Results
            if isSearching {
                ProgressView()
                    .tint(Theme.accent)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if results.isEmpty && query.count >= 2 {
                VStack(spacing: Theme.spacingMD) {
                    Image(systemName: "person.fill.questionmark")
                        .font(.system(size: 36))
                        .foregroundStyle(Theme.textSecondary)
                    Text("No players found for \"\(query)\"")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(Theme.spacingXL)
            } else {
                List(results) { player in
                    NavigationLink {
                        PlayerDetailView(playerId: player.id, playerName: player.fullName)
                    } label: {
                        PlayerSearchRow(player: player)
                    }
                    .listRowBackground(Theme.card)
                    .listRowSeparatorTint(Color.white.opacity(0.08))
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(Theme.background)
            }
        }
        .background(Theme.background)
        .navigationTitle("Player Search")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { isFocused = true }
        .onChange(of: query) { _, newValue in
            Task { await search(query: newValue) }
        }
    }

    private func search(query: String) async {
        guard query.count >= 2 else {
            results = []
            return
        }
        isSearching = true
        do {
            results = try await APIClient.shared.searchPlayers(query: query)
        } catch {
            results = []
        }
        isSearching = false
    }
}

// MARK: - Search Result Row

private struct PlayerSearchRow: View {
    let player: PlayerSearchResult

    var positionColor: Color {
        switch player.position?.uppercased() {
        case "QB": return Color(hex: 0xF87171)
        case "RB": return Color(hex: 0x67E8F9)
        case "WR": return Color(hex: 0xC9A96E)
        case "TE": return Color(hex: 0x4ADE80)
        case "K":  return Color(hex: 0xC084FC)
        case "DEF": return Color(hex: 0xFB923C)
        default:   return Color(hex: 0x8A8578)
        }
    }

    var body: some View {
        HStack(spacing: Theme.spacingMD) {
            ZStack {
                Circle()
                    .fill(positionColor.opacity(0.15))
                    .frame(width: 38, height: 38)
                Text(player.position ?? "?")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(positionColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(player.fullName)
                    .font(Theme.titleFont)
                    .foregroundStyle(Theme.textPrimary)
                if let team = player.nflTeam {
                    Text(team)
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textSecondary)
                }
            }

            Spacer()

            if let status = player.status, status != "active" {
                Text(status.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.loss)
            }
        }
        .padding(.vertical, 6)
    }
}
