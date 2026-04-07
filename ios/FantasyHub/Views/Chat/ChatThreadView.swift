import SwiftUI

/// Full-screen chat interface for a single named thread.
/// Loads message history, renders message bubbles, and streams
/// new assistant responses via SSE using URLSession AsyncBytes.
struct ChatThreadView: View {
    let league: League
    let thread: ChatThread

    @State private var manager = ChatStreamingManager()
    @State private var inputText = ""

    var body: some View {
        VStack(spacing: 0) {
            chatScrollView
            if let errorMessage = manager.errorMessage { errorBanner(errorMessage) }
            ChatInputBar(
                text: $inputText,
                isStreaming: manager.isStreaming,
                onSend: {
                    let content = inputText.trimmingCharacters(in: .whitespaces)
                    guard !content.isEmpty else { return }
                    inputText = ""
                    manager.send(content, leagueId: league.id, threadId: thread.id)
                },
                onStop: { manager.cancelStream() }
            )
        }
        .background(Theme.background)
        .navigationTitle(thread.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await manager.loadHistory(leagueId: league.id, threadId: thread.id) }
        .preference(key: TabBarHiddenKey.self, value: true)
    }

    // MARK: - Subviews

    private var chatScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Theme.spacingSM) {
                    if manager.isLoadingHistory {
                        ProgressView()
                            .tint(Theme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(Theme.spacingMD)
                    }
                    ForEach(manager.messages) { message in
                        ChatMessageBubble(message: message)
                            .padding(.horizontal, Theme.spacingMD)
                            .id(message.id)
                    }
                    if manager.isShowingTypingIndicator && manager.streamingContent.isEmpty {
                        ChatStreamingIndicator()
                            .padding(.horizontal, Theme.spacingMD)
                            .id("typing_indicator")
                    }
                    if !manager.streamingContent.isEmpty {
                        StreamingMessageBubble(content: manager.streamingContent)
                            .padding(.horizontal, Theme.spacingMD)
                            .id("streaming_bubble")
                    }
                    if let toolName = manager.activeStreamingToolName {
                        toolCallIndicator(toolName)
                            .padding(.horizontal, Theme.spacingMD)
                    }
                    Color.clear.frame(height: 1).id("bottom_anchor")
                }
                .padding(.vertical, Theme.spacingMD)
            }
            .background(Theme.background)
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: manager.messages.count) { _, _ in scrollToBottom(proxy: proxy) }
            .onChange(of: manager.streamingContent) { _, _ in scrollToBottom(proxy: proxy) }
            .onChange(of: manager.isShowingTypingIndicator) { _, _ in scrollToBottom(proxy: proxy) }
            .onChange(of: manager.activeStreamingToolName) { _, _ in scrollToBottom(proxy: proxy) }
        }
    }

    private func toolCallIndicator(_ toolName: String) -> some View {
        HStack(spacing: Theme.spacingSM) {
            ProgressView().tint(Theme.accentMuted).controlSize(.mini)
            Text("Looking up \(toolName)…")
                .font(Theme.captionFont)
                .foregroundStyle(Theme.textSecondary)
            Spacer()
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingXS)
        .background(Theme.surface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: "exclamationmark.triangle").foregroundStyle(Theme.loss)
            Text(message).font(Theme.captionFont).foregroundStyle(Theme.loss)
            Spacer()
            Button { manager.errorMessage = nil } label: {
                Image(systemName: "xmark")
                    .foregroundStyle(Theme.textSecondary)
                    .font(Theme.captionFont)
            }
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingSM)
        .background(Theme.loss.opacity(0.12))
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) {
            proxy.scrollTo("bottom_anchor", anchor: .bottom)
        }
    }
}
