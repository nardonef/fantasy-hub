import SwiftUI

/// Half-height sheet showing all chat threads for the active league.
/// Tapping a thread fires onSelect and dismisses the sheet.
struct ThreadHistorySheet: View {
    let leagueId: String
    let onSelect: (ChatThread) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var threads: [ChatThread] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .tint(Theme.accent)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if threads.isEmpty {
                    emptyState
                } else {
                    threadList
                }
            }
            .background(Theme.background)
            .navigationTitle("Conversations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .task { await loadThreads() }
    }

    // MARK: - Subviews

    private var threadList: some View {
        List {
            ForEach(threads) { thread in
                Button {
                    onSelect(thread)
                    dismiss()
                } label: {
                    threadRow(thread)
                }
                .buttonStyle(.plain)
                .listRowBackground(Theme.card)
                .listRowSeparatorTint(Theme.borderGold)
            }
            .onDelete(perform: deleteThreads)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .refreshable { await loadThreads() }
    }

    private var emptyState: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: "bubble.left.and.text.bubble.right")
                .font(.system(size: 40))
                .foregroundStyle(Theme.accentMuted)
            Text("No Conversations Yet")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
            Text("Start a new chat from the main view.")
                .font(Theme.captionFont)
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func threadRow(_ thread: ChatThread) -> some View {
        HStack(spacing: Theme.spacingMD) {
            VStack(alignment: .leading, spacing: Theme.spacingXS) {
                Text(thread.title)
                    .font(Theme.titleFont)
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                if let count = thread.messageCount, count > 0 {
                    Text("\(count) message\(count == 1 ? "" : "s")")
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer()
            Text(thread.updatedAt.relativeLabel)
                .font(Theme.captionFont)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.vertical, Theme.spacingSM)
    }

    // MARK: - Actions

    private func loadThreads() async {
        isLoading = true
        defer { isLoading = false }
        do {
            threads = try await APIClient.shared.getThreads(leagueId: leagueId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteThreads(at offsets: IndexSet) {
        let toDelete = offsets.map { threads[$0] }
        threads.remove(atOffsets: offsets) // optimistic
        Task {
            for thread in toDelete {
                do {
                    try await APIClient.shared.deleteThread(leagueId: leagueId, threadId: thread.id)
                } catch {
                    // Rollback on failure
                    await MainActor.run {
                        threads.insert(thread, at: threads.startIndex)
                    }
                }
            }
        }
    }
}

// MARK: - Date Extension (shared with ThreadListView)

private extension Date {
    var relativeLabel: String {
        let seconds = Int(Date().timeIntervalSince(self))
        switch seconds {
        case ..<60: return "Just now"
        case ..<3600: return "\(seconds / 60)m ago"
        case ..<86400: return "\(seconds / 3600)h ago"
        default:
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: self)
        }
    }
}
