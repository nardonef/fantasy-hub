import SwiftUI

struct InviteView: View {
    let inviteCode: String
    @EnvironmentObject var leagueStore: LeagueStore
    @Environment(\.dismiss) private var dismiss

    @State private var preview: InvitePreview?
    @State private var isLoading = true
    @State private var isJoining = false
    @State private var joinedLeague: JoinLeagueResponse?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                if isLoading {
                    ProgressView()
                        .tint(Theme.accent)
                } else if let error = errorMessage {
                    errorState(message: error)
                } else if let joined = joinedLeague {
                    successState(league: joined)
                } else if let preview {
                    inviteContent(preview: preview)
                }
            }
            .navigationTitle("League Invite")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .task {
            await loadPreview()
        }
    }

    // MARK: - Content States

    @ViewBuilder
    private func inviteContent(preview: InvitePreview) -> some View {
        VStack(spacing: Theme.spacingLG) {
            Spacer()

            // League icon
            Circle()
                .fill(Theme.accent.opacity(0.2))
                .frame(width: 80, height: 80)
                .overlay {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(Theme.accent)
                }

            // League info
            VStack(spacing: Theme.spacingSM) {
                Text(preview.leagueName)
                    .font(Theme.headlineFont)
                    .foregroundStyle(Theme.textPrimary)

                HStack(spacing: Theme.spacingMD) {
                    Label(preview.provider.displayName, systemImage: preview.provider.iconName)
                    Label("\(preview.memberCount) members", systemImage: "person.2.fill")
                }
                .font(Theme.captionFont)
                .foregroundStyle(Theme.textSecondary)
            }

            if preview.isValid {
                Button {
                    Task { await joinInvite() }
                } label: {
                    HStack(spacing: Theme.spacingSM) {
                        if isJoining {
                            ProgressView()
                                .tint(Theme.background)
                        }
                        Text("Join League")
                            .font(Theme.titleFont)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(Theme.spacingMD)
                    .background(Theme.accent)
                    .foregroundStyle(Theme.background)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .disabled(isJoining)
                .padding(.horizontal, Theme.spacingXL)
            } else {
                VStack(spacing: Theme.spacingSM) {
                    Image(systemName: "clock.badge.xmark")
                        .font(.system(size: 24))
                        .foregroundStyle(Theme.loss)
                    Text("This invite has expired")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                }
            }

            Spacer()
        }
        .padding(Theme.spacingMD)
    }

    @ViewBuilder
    private func successState(league: JoinLeagueResponse) -> some View {
        VStack(spacing: Theme.spacingLG) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(Theme.win)

            VStack(spacing: Theme.spacingSM) {
                Text(league.alreadyMember ? "Already a Member" : "Welcome!")
                    .font(Theme.headlineFont)
                    .foregroundStyle(Theme.textPrimary)

                Text("You're in \(league.name)")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
            }

            Button {
                leagueStore.setActiveLeague(league.id)
                dismiss()
            } label: {
                Text("Go to League")
                    .font(Theme.titleFont)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.spacingMD)
                    .background(Theme.accent)
                    .foregroundStyle(Theme.background)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            }
            .padding(.horizontal, Theme.spacingXL)

            Spacer()
        }
        .padding(Theme.spacingMD)
    }

    @ViewBuilder
    private func errorState(message: String) -> some View {
        VStack(spacing: Theme.spacingLG) {
            Spacer()

            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.loss)

            Text(message)
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)

            Button {
                dismiss()
            } label: {
                Text("Close")
                    .font(Theme.titleFont)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.spacingMD)
                    .background(Theme.accent.opacity(0.2))
                    .foregroundStyle(Theme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            }
            .padding(.horizontal, Theme.spacingXL)

            Spacer()
        }
        .padding(Theme.spacingMD)
    }

    // MARK: - Actions

    private func loadPreview() async {
        isLoading = true
        defer { isLoading = false }

        do {
            preview = try await APIClient.shared.previewInvite(code: inviteCode)
        } catch {
            errorMessage = "Could not load invite. It may no longer exist."
        }
    }

    private func joinInvite() async {
        isJoining = true
        defer { isJoining = false }

        do {
            let response = try await APIClient.shared.joinLeague(inviteCode: inviteCode)
            joinedLeague = response
            // Refresh the league list so the new league shows up
            await leagueStore.loadLeagues()
        } catch {
            errorMessage = "Failed to join league. Please try again."
        }
    }
}
