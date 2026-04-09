import SwiftUI

/// Horizontally scrollable chips showing the user's last 5 threads for a league.
/// Tapping a chip resumes that conversation.
struct RecentThreadChips: View {
    let leagueId: String
    let onSelect: (ChatThread) -> Void

    @State private var threads: [ChatThread] = []

    var body: some View {
        Group {
            if !threads.isEmpty {
                VStack(alignment: .leading, spacing: Theme.spacingXS) {
                    Text("Recent")
                        .font(Theme.captionFont)
                        .foregroundStyle(Theme.textSecondary)
                        .padding(.horizontal, Theme.spacingMD)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Theme.spacingSM) {
                            ForEach(threads) { thread in
                                Button {
                                    onSelect(thread)
                                } label: {
                                    Text(thread.title)
                                        .font(Theme.captionFont)
                                        .foregroundStyle(Theme.textPrimary)
                                        .lineLimit(1)
                                        .padding(.horizontal, Theme.spacingMD)
                                        .padding(.vertical, Theme.spacingSM)
                                        .background(Theme.card)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(Theme.borderGold, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, Theme.spacingMD)
                    }
                }
            }
        }
        .task(id: leagueId) {
            do {
                let all = try await APIClient.shared.getThreads(leagueId: leagueId)
                threads = Array(all.prefix(5))
            } catch {
                // Non-critical — chips simply don't appear
            }
        }
    }
}
