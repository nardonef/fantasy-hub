import SwiftUI

struct LeagueView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var managers: [Manager] = []
    @State private var isGeneratingInvite = false
    @State private var shareURL: URL?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Theme.spacingLG) {
                    // League info
                    if let league = leagueStore.activeLeague {
                        VStack(alignment: .leading, spacing: Theme.spacingSM) {
                            Text("LEAGUE INFO")
                                .sectionHeaderStyle()

                            VStack(spacing: 12) {
                                InfoRow(label: "Provider", value: league.provider.displayName)
                                InfoRow(label: "Scoring", value: league.scoringType?.uppercased() ?? "—")
                                InfoRow(label: "Teams", value: "\(league.teamCount ?? 0)")
                                InfoRow(label: "Seasons", value: "\(league.seasons.count)")
                            }
                            .padding(Theme.spacingMD)
                            .cardStyle()
                        }

                        // Members
                        VStack(alignment: .leading, spacing: Theme.spacingSM) {
                            HStack {
                                Text("MANAGERS")
                                    .sectionHeaderStyle()
                                Spacer()
                                Button {
                                    Task { await generateInvite(leagueId: league.id) }
                                } label: {
                                    HStack(spacing: Theme.spacingXS) {
                                        if isGeneratingInvite {
                                            ProgressView()
                                                .tint(Theme.accent)
                                                .controlSize(.mini)
                                        }
                                        Label("Invite", systemImage: "person.badge.plus")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(Theme.accent)
                                    }
                                }
                                .disabled(isGeneratingInvite)
                            }

                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible()),
                                GridItem(.flexible()),
                            ], spacing: Theme.spacingSM) {
                                ForEach(managers) { manager in
                                    NavigationLink {
                                        ManagerProfileView(
                                            managerId: manager.id,
                                            managerName: manager.name
                                        )
                                    } label: {
                                        ManagerCard(manager: manager)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(Theme.spacingMD)
                .padding(.bottom, 100)
            }
            .background(Theme.background)
            .navigationTitle("League")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(item: $shareURL) { url in
                ShareSheet(activityItems: [url])
            }
        }
    }

    private func generateInvite(leagueId: String) async {
        isGeneratingInvite = true
        defer { isGeneratingInvite = false }

        do {
            let response = try await APIClient.shared.generateInviteLink(leagueId: leagueId)
            if let url = URL(string: response.inviteUrl) {
                shareURL = url
            }
        } catch {
            // Silently fail — could add error toast in future
        }
    }
}

// Make URL conform to Identifiable for sheet(item:)
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            Text(value)
                .font(Theme.tabularFont)
                .foregroundStyle(Theme.textPrimary)
        }
    }
}

struct ManagerCard: View {
    let manager: Manager

    var body: some View {
        VStack(spacing: 8) {
            Circle()
                .fill(Theme.accent.opacity(0.2))
                .frame(width: 48, height: 48)
                .overlay {
                    Text(String(manager.name.prefix(1)).uppercased())
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.accent)
                }

            Text(manager.name)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)
        }
        .padding(Theme.spacingSM)
        .frame(maxWidth: .infinity)
        .cardStyle()
    }
}
