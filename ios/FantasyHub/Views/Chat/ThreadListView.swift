import SwiftUI

/// Lists all named chat threads for a single league.
/// Provides a toolbar button to create new threads and swipe-to-delete.
struct ThreadListView: View {
    let league: League

    @State private var threads: [ChatThread] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showNewThreadSheet = false

    var body: some View {
        Group {
            if isLoading && threads.isEmpty {
                loadingView
            } else if threads.isEmpty {
                emptyState
            } else {
                threadList
            }
        }
        .background(Theme.background)
        .navigationTitle(league.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showNewThreadSheet = true
                } label: {
                    Label("New Chat", systemImage: "square.and.pencil")
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .sheet(isPresented: $showNewThreadSheet) {
            NewThreadSheet(leagueId: league.id) { newThread in
                threads.insert(newThread, at: 0)
            }
        }
        .task {
            await loadThreads()
        }
        .alert("Error", isPresented: .constant(errorMessage != nil), actions: {
            Button("Dismiss") { errorMessage = nil }
        }, message: {
            Text(errorMessage ?? "")
        })
    }

    // MARK: - Subviews

    private var threadList: some View {
        List {
            ForEach(threads) { thread in
                NavigationLink {
                    ChatThreadView(league: league, thread: thread)
                } label: {
                    ThreadRow(thread: thread)
                }
                .listRowBackground(Theme.card)
                .listRowSeparatorTint(Theme.borderGold)
            }
            .onDelete { indexSet in
                Task { await deleteThreads(at: indexSet) }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .refreshable {
            await loadThreads()
        }
    }

    private var loadingView: some View {
        VStack(spacing: Theme.spacingMD) {
            ProgressView()
                .tint(Theme.accent)
            Text("Loading threads…")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: "bubble.left")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent.opacity(0.6))
            Text("No Conversations Yet")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
            Text("Tap the pencil icon to start a new conversation about \(league.name).")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.spacingXL)
            Button {
                showNewThreadSheet = true
            } label: {
                Label("New Chat", systemImage: "square.and.pencil")
                    .font(Theme.bodyFont.weight(.semibold))
                    .foregroundStyle(Theme.background)
                    .padding(.horizontal, Theme.spacingLG)
                    .padding(.vertical, Theme.spacingSM)
                    .background(Theme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
            }
            .padding(.top, Theme.spacingSM)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Actions

    private func loadThreads() async {
        isLoading = true
        defer { isLoading = false }
        do {
            threads = try await APIClient.shared.getThreads(leagueId: league.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteThreads(at indexSet: IndexSet) async {
        let toDelete = indexSet.map { threads[$0] }
        // Optimistically remove from local list
        threads.remove(atOffsets: indexSet)
        for thread in toDelete {
            do {
                try await APIClient.shared.deleteThread(leagueId: league.id, threadId: thread.id)
            } catch {
                // Re-insert on failure and surface the error
                threads.insert(thread, at: 0)
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Thread Row

private struct ThreadRow: View {
    let thread: ChatThread

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingXS) {
            Text(thread.title)
                .font(Theme.titleFont)
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)

            HStack(spacing: Theme.spacingSM) {
                if let count = thread.messageCount {
                    Text("\(count) message\(count == 1 ? "" : "s")")
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Text(thread.updatedAt.relativeLabel)
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(.vertical, Theme.spacingXS)
    }
}

// MARK: - Date Extension

private extension Date {
    /// Returns a concise relative label: "just now", "5m", "3h", "Mar 15", etc.
    var relativeLabel: String {
        let elapsed = Date().timeIntervalSince(self)
        if elapsed < 60 { return "just now" }
        let minutes = Int(elapsed / 60)
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = Int(elapsed / 3600)
        if hours < 24 { return "\(hours)h ago" }
        let formatter = DateFormatter()
        let calendar = Calendar.current
        formatter.dateFormat = calendar.isDate(self, equalTo: Date(), toGranularity: .year)
            ? "MMM d"
            : "MMM d, yyyy"
        return formatter.string(from: self)
    }
}
