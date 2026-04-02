import SwiftUI

/// Full-screen chat interface for a single named thread.
/// Loads message history, renders message bubbles, and streams
/// new assistant responses via SSE using URLSession AsyncBytes.
struct ChatThreadView: View {
    let league: League
    let thread: ChatThread

    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isStreaming = false
    @State private var streamingContent = ""
    @State private var isShowingTypingIndicator = false
    @State private var activeStreamingToolName: String? = nil
    @State private var isLoadingHistory = false
    @State private var errorMessage: String?
    @State private var scrollProxy: ScrollViewProxy? = nil

    /// Task handle for the active streaming request, so it can be cancelled.
    @State private var streamTask: Task<Void, Never>? = nil

    var body: some View {
        VStack(spacing: 0) {
            // Message list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Theme.spacingSM) {
                        if isLoadingHistory {
                            ProgressView()
                                .tint(Theme.accent)
                                .frame(maxWidth: .infinity)
                                .padding(Theme.spacingMD)
                        }

                        ForEach(messages) { message in
                            ChatMessageBubble(message: message)
                                .padding(.horizontal, Theme.spacingMD)
                                .id(message.id)
                        }

                        // Streaming states
                        if isShowingTypingIndicator && streamingContent.isEmpty {
                            ChatStreamingIndicator()
                                .padding(.horizontal, Theme.spacingMD)
                                .id("typing_indicator")
                        }

                        if !streamingContent.isEmpty {
                            StreamingMessageBubble(content: streamingContent)
                                .padding(.horizontal, Theme.spacingMD)
                                .id("streaming_bubble")
                        }

                        if let toolName = activeStreamingToolName {
                            toolCallIndicator(toolName)
                                .padding(.horizontal, Theme.spacingMD)
                        }

                        // Anchor for auto-scroll
                        Color.clear
                            .frame(height: 1)
                            .id("bottom_anchor")
                    }
                    .padding(.vertical, Theme.spacingMD)
                }
                .background(Theme.background)
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: messages.count) { _, _ in scrollToBottom(proxy: proxy) }
                .onChange(of: streamingContent) { _, _ in scrollToBottom(proxy: proxy) }
                .onChange(of: isShowingTypingIndicator) { _, _ in scrollToBottom(proxy: proxy) }
                .onChange(of: activeStreamingToolName) { _, _ in scrollToBottom(proxy: proxy) }
                .onAppear { scrollProxy = proxy }
            }

            // Error banner
            if let errorMessage {
                errorBanner(errorMessage)
            }

            // Input bar
            ChatInputBar(
                text: $inputText,
                isStreaming: isStreaming,
                onSend: {
                    let content = inputText.trimmingCharacters(in: .whitespaces)
                    guard !content.isEmpty else { return }
                    inputText = ""
                    streamTask = Task { await sendMessage(content) }
                },
                onStop: {
                    streamTask?.cancel()
                    streamTask = nil
                    finalizeStream()
                }
            )
        }
        .background(Theme.background)
        .navigationTitle(thread.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            await loadHistory()
        }
    }

    // MARK: - Inline Subviews

    private func toolCallIndicator(_ toolName: String) -> some View {
        HStack(spacing: Theme.spacingSM) {
            ProgressView()
                .tint(Theme.accentMuted)
                .controlSize(.mini)
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
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(Theme.loss)
            Text(message)
                .font(Theme.captionFont)
                .foregroundStyle(Theme.loss)
            Spacer()
            Button {
                errorMessage = nil
            } label: {
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

    private func loadHistory() async {
        isLoadingHistory = true
        defer { isLoadingHistory = false }
        do {
            messages = try await APIClient.shared.getMessages(
                leagueId: league.id,
                threadId: thread.id
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func sendMessage(_ content: String) async {
        errorMessage = nil

        // 1. Append a local user message immediately for responsiveness.
        let localUserMessage = ChatMessage(
            id: UUID().uuidString,
            threadId: thread.id,
            role: "user",
            content: content,
            toolName: nil,
            createdAt: Date()
        )
        messages.append(localUserMessage)

        // 2. Show typing indicator while waiting for first token.
        isStreaming = true
        isShowingTypingIndicator = true
        streamingContent = ""
        activeStreamingToolName = nil

        do {
            // 3. Build the authenticated request for the SSE endpoint.
            let request = try await APIClient.shared.sendMessageRequest(
                leagueId: league.id,
                threadId: thread.id,
                content: content
            )

            // 4. Open the byte stream.
            let (asyncBytes, response) = try await URLSession.shared.bytes(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                throw APIError.invalidResponse
            }

            // 5. Iterate SSE lines.
            for try await line in asyncBytes.lines {
                // Check for task cancellation.
                try Task.checkCancellation()

                guard line.hasPrefix("data: ") else { continue }
                let jsonStr = String(line.dropFirst(6))
                guard let event = ChatSSEEvent.parse(from: jsonStr) else { continue }

                // All UI mutations on the main actor.
                await MainActor.run {
                    handleSSEEvent(event)
                }
            }
        } catch is CancellationError {
            // User tapped stop — finalize gracefully (already called in onStop).
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                finalizeStream()
            }
        }
    }

    @MainActor
    private func handleSSEEvent(_ event: ChatSSEEvent) {
        switch event {
        case .delta(let content):
            isShowingTypingIndicator = false
            streamingContent += content

        case .toolCall(let toolName, _):
            isShowingTypingIndicator = false
            activeStreamingToolName = toolName

        case .done(let messageId):
            // Replace the streaming bubble with the persisted assistant message.
            let finalMessage = ChatMessage(
                id: messageId,
                threadId: thread.id,
                role: "assistant",
                content: streamingContent,
                toolName: nil,
                createdAt: Date()
            )
            messages.append(finalMessage)
            finalizeStream()

        case .error(let message):
            errorMessage = message
            finalizeStream()
        }
    }

    @MainActor
    private func finalizeStream() {
        isStreaming = false
        isShowingTypingIndicator = false
        streamingContent = ""
        activeStreamingToolName = nil
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) {
            proxy.scrollTo("bottom_anchor", anchor: .bottom)
        }
    }
}
