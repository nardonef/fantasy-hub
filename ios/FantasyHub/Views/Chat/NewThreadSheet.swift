import SwiftUI

/// Modal sheet for creating a new named chat thread.
struct NewThreadSheet: View {
    let leagueId: String
    let onCreated: (ChatThread) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var isCreating = false
    @State private var errorMessage: String?

    private var canCreate: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !isCreating
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    Text("CONVERSATION TITLE")
                        .sectionHeaderStyle()

                    TextField("e.g. 2024 Draft Review", text: $title)
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textPrimary)
                        .tint(Theme.accent)
                        .padding(Theme.spacingMD)
                        .background(Theme.card)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.radiusMD)
                                .strokeBorder(
                                    title.isEmpty ? Theme.borderGold : Theme.accent.opacity(0.5),
                                    lineWidth: 1
                                )
                        )
                        .submitLabel(.done)
                        .onSubmit {
                            if canCreate { Task { await createThread() } }
                        }
                }

                Text("Give your conversation a descriptive name so you can find it later.")
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)

                if let errorMessage {
                    Text(errorMessage)
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.loss)
                        .padding(Theme.spacingSM)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.loss.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
                }

                Spacer()

                Button {
                    Task { await createThread() }
                } label: {
                    HStack(spacing: Theme.spacingSM) {
                        if isCreating {
                            ProgressView()
                                .tint(Theme.background)
                                .controlSize(.small)
                        }
                        Text(isCreating ? "Creating…" : "Create Conversation")
                            .font(Theme.bodyFont.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.spacingMD)
                    .background(canCreate ? Theme.accent : Theme.mutedGold)
                    .foregroundStyle(Theme.background)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .disabled(!canCreate)
                .animation(.easeInOut(duration: 0.15), value: canCreate)
            }
            .padding(Theme.spacingMD)
            .background(Theme.background)
            .navigationTitle("New Conversation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.accent)
                        .disabled(isCreating)
                }
            }
        }
    }

    // MARK: - Actions

    private func createThread() async {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        isCreating = true
        errorMessage = nil
        defer { isCreating = false }

        do {
            let thread = try await APIClient.shared.createThread(leagueId: leagueId, title: trimmed)
            onCreated(thread)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
