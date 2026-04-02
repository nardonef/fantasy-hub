import SwiftUI

struct ManagerClaimView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @Environment(\.dismiss) private var dismiss

    let managers: [Manager]
    let onClaimed: (Manager) -> Void

    @State private var isClaimingId: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Theme.spacingMD) {
                    Text("Which manager are you?")
                        .font(Theme.headlineFont)
                        .foregroundStyle(Theme.textPrimary)
                        .padding(.top, Theme.spacingLG)

                    Text("Select your manager to unlock your personal dashboard with career stats, rival records, and rank history.")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Theme.spacingLG)

                    VStack(spacing: 0) {
                        ForEach(Array(managers.enumerated()), id: \.element.id) { index, manager in
                            Button {
                                Task { await claim(manager) }
                            } label: {
                                HStack(spacing: Theme.spacingSM) {
                                    Circle()
                                        .fill(Theme.accent.opacity(0.2))
                                        .frame(width: 40, height: 40)
                                        .overlay {
                                            Text(String(manager.name.prefix(1)).uppercased())
                                                .font(.system(size: 16, weight: .bold))
                                                .foregroundStyle(Theme.accent)
                                        }

                                    Text(manager.name)
                                        .font(Theme.titleFont)
                                        .foregroundStyle(Theme.textPrimary)

                                    Spacer()

                                    if isClaimingId == manager.id {
                                        ProgressView()
                                            .tint(Theme.accent)
                                    } else {
                                        Image(systemName: "chevron.right")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(Theme.dimText)
                                    }
                                }
                                .padding(Theme.spacingMD)
                                .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)
                            }
                            .disabled(isClaimingId != nil)

                            if index < managers.count - 1 {
                                Divider().background(Theme.surface)
                            }
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    .padding(.horizontal, Theme.spacingMD)
                }
                .padding(.bottom, 100)
            }
            .background(Theme.background)
            .navigationTitle("Claim Manager")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
    }

    private func claim(_ manager: Manager) async {
        guard let leagueId = leagueStore.activeLeagueId else { return }
        isClaimingId = manager.id

        do {
            let claimed = try await APIClient.shared.claimManager(leagueId: leagueId, managerId: manager.id)
            onClaimed(claimed)
            dismiss()
        } catch {
            isClaimingId = nil
        }
    }
}
