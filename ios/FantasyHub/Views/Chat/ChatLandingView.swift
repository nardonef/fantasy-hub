import SwiftUI

/// Root view for the AI Chat tab.
/// Idle state: suggested prompts + recent threads + input bar.
/// Active state: full conversation view + input bar.
/// No navigation required — just tap the tab and type.
struct ChatLandingView: View {
    @EnvironmentObject var leagueStore: LeagueStore

    @State private var manager = ChatStreamingManager()
    @State private var inputText = ""
    @State private var activeThreadId: String? = nil
    @State private var activeThreadTitle = ""
    @State private var isShowingHistory = false
    /// Stores the user's first message while waiting for thread_created from /quick.
    @State private var pendingQuickContent: String? = nil

    private var isActive: Bool { activeThreadId != nil }
    private var activeLeague: League? { leagueStore.activeLeague }

    var body: some View {
        NavigationStack {
            Group {
                if leagueStore.leagues.isEmpty {
                    noLeaguesState
                } else if let league = activeLeague {
                    chatContent(for: league)
                }
            }
            .background(Theme.background)
            .navigationTitle(isActive ? activeThreadTitle : "AI Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar { toolbarContent }
            .sheet(isPresented: $isShowingHistory) { historySheet }
            .preference(key: TabBarHiddenKey.self, value: false)
            .onChange(of: leagueStore.activeLeagueId) { _, _ in resetToIdle() }
            .onChange(of: manager.createdThread?.id) { _, _ in handleThreadCreated() }
        }
    }

    // MARK: - High-level Layout

    @ViewBuilder
    private func chatContent(for league: League) -> some View {
        VStack(spacing: 0) {
            if isActive {
                chatScrollView
            } else {
                idleScrollView(for: league)
            }
            if let error = manager.errorMessage { errorBanner(error) }
            ChatInputBar(
                text: $inputText,
                isStreaming: manager.isStreaming,
                onSend: {
                    let content = inputText.trimmingCharacters(in: .whitespaces)
                    guard !content.isEmpty, let league = activeLeague else { return }
                    inputText = ""
                    sendMessage(content, league: league)
                },
                onStop: { manager.cancelStream() }
            )
        }
    }

    // MARK: - Idle View

    private func idleScrollView(for league: League) -> some View {
        ScrollView {
            VStack(spacing: Theme.spacingXL) {
                idleHeader
                SuggestedPromptChips { prompt in
                    guard let league = activeLeague else { return }
                    inputText = ""
                    sendMessage(prompt, league: league)
                }
                RecentThreadChips(leagueId: league.id) { thread in
                    loadThread(thread, league: league)
                }
            }
            .padding(.vertical, Theme.spacingXL)
        }
        .background(Theme.background)
    }

    private var idleHeader: some View {
        VStack(spacing: Theme.spacingSM) {
            Image(systemName: "sparkles")
                .font(.system(size: 36))
                .foregroundStyle(Theme.accent)
            Text("Ask anything about your league")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, Theme.spacingMD)
    }

    // MARK: - Active Chat View

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

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            LeaguePickerPill()
        }
        ToolbarItem(placement: .navigationBarTrailing) {
            HStack(spacing: Theme.spacingSM) {
                if isActive {
                    Button(action: resetToIdle) {
                        Image(systemName: "square.and.pencil")
                            .foregroundStyle(Theme.accent)
                    }
                }
                Button { isShowingHistory = true } label: {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundStyle(Theme.accent)
                }
            }
        }
    }

    // MARK: - History Sheet

    @ViewBuilder
    private var historySheet: some View {
        if let league = activeLeague {
            ThreadHistorySheet(leagueId: league.id) { thread in
                loadThread(thread, league: league)
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - No Leagues State

    private var noLeaguesState: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: "bubble.left.and.text.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
            Text("No Leagues Connected")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
            Text("Connect a league to start chatting with your AI assistant.")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.spacingXL)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Inline Subviews

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

    // MARK: - Actions

    private func sendMessage(_ content: String, league: League) {
        if let threadId = activeThreadId {
            // Existing thread — manager adds the optimistic user bubble internally
            manager.send(content, leagueId: league.id, threadId: threadId)
        } else {
            // New thread — save content so we can add the user bubble on thread_created
            pendingQuickContent = content
            manager.sendQuick(content, leagueId: league.id)
        }
    }

    private func loadThread(_ thread: ChatThread, league: League) {
        manager.reset()
        activeThreadId = thread.id
        activeThreadTitle = thread.title
        Task { await manager.loadHistory(leagueId: league.id, threadId: thread.id) }
    }

    private func resetToIdle() {
        manager.reset()
        activeThreadId = nil
        activeThreadTitle = ""
        pendingQuickContent = nil
    }

    /// Called when `manager.createdThread` changes — fired by the /quick SSE endpoint.
    private func handleThreadCreated() {
        guard let created = manager.createdThread,
              let content = pendingQuickContent else { return }
        // Add the user message bubble now that we have the real threadId
        manager.messages.append(ChatMessage(
            id: UUID().uuidString,
            threadId: created.id,
            role: "user",
            content: content,
            createdAt: Date()
        ))
        activeThreadId = created.id
        activeThreadTitle = created.title
        pendingQuickContent = nil
        manager.createdThread = nil // clear to avoid re-triggering
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) {
            proxy.scrollTo("bottom_anchor", anchor: .bottom)
        }
    }
}
