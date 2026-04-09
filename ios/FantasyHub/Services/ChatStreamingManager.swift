import SwiftUI

/// Owns all mutable state for an active (or idle) AI chat session.
/// Used by both ChatLandingView (new threads) and ChatThreadView (existing threads).
@Observable
@MainActor
final class ChatStreamingManager {

    // MARK: - Published State

    var messages: [ChatMessage] = []
    var isStreaming = false
    var streamingContent = ""
    var isShowingTypingIndicator = false
    var activeStreamingToolName: String? = nil
    var isLoadingHistory = false
    var errorMessage: String? = nil

    // MARK: - Observable Thread Creation Signal

    /// Set when the /quick endpoint creates a new thread (fires before first delta).
    /// The view observes this and resets it to nil after reading.
    /// Tuple: (threadId, title)
    var createdThread: (id: String, title: String)? = nil

    // MARK: - Private

    private var streamTask: Task<Void, Never>? = nil
    private var currentThreadId = ""

    // MARK: - Public API

    /// Load full message history for an existing thread.
    func loadHistory(leagueId: String, threadId: String) async {
        isLoadingHistory = true
        defer { isLoadingHistory = false }
        currentThreadId = threadId
        do {
            messages = try await APIClient.shared.getMessages(leagueId: leagueId, threadId: threadId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Send a message in an already-created thread.
    func send(_ content: String, leagueId: String, threadId: String) {
        streamTask = Task { await performSend(content, leagueId: leagueId, threadId: threadId) }
    }

    /// Create a new thread and stream the first response in one round trip.
    /// The `onThreadCreated` callback is fired before the first delta arrives.
    func sendQuick(_ content: String, leagueId: String) {
        streamTask = Task { await performQuickSend(content, leagueId: leagueId) }
    }

    /// Cancel the active stream gracefully.
    func cancelStream() {
        streamTask?.cancel()
        streamTask = nil
        finalizeStream()
    }

    /// Reset to idle state (no messages, no active thread).
    func reset() {
        cancelStream()
        messages = []
        currentThreadId = ""
        errorMessage = nil
    }

    // MARK: - Private Implementation

    private func performSend(_ content: String, leagueId: String, threadId: String) async {
        currentThreadId = threadId
        errorMessage = nil

        // Optimistic user message with local UUID so the bubble appears immediately
        messages.append(ChatMessage(
            id: UUID().uuidString,
            threadId: threadId,
            role: "user",
            content: content,
            createdAt: Date()
        ))

        isStreaming = true
        isShowingTypingIndicator = true
        streamingContent = ""
        activeStreamingToolName = nil

        do {
            let request = try await APIClient.shared.sendMessageRequest(
                leagueId: leagueId,
                threadId: threadId,
                content: content
            )
            try await consumeSSEStream(request)
        } catch is CancellationError {
            // User tapped stop — finalizeStream already called in cancelStream()
        } catch {
            errorMessage = error.localizedDescription
            finalizeStream()
        }
    }

    private func performQuickSend(_ content: String, leagueId: String) async {
        errorMessage = nil

        // Show typing indicator while the server creates the thread
        isStreaming = true
        isShowingTypingIndicator = true
        streamingContent = ""
        activeStreamingToolName = nil

        do {
            let request = try await APIClient.shared.quickChatRequest(leagueId: leagueId, content: content)
            try await consumeSSEStream(request)
        } catch is CancellationError {
            // User tapped stop
        } catch {
            errorMessage = error.localizedDescription
            finalizeStream()
        }
    }

    private func consumeSSEStream(_ request: URLRequest) async throws {
        let (asyncBytes, response) = try await URLSession.shared.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.invalidResponse
        }
        for try await line in asyncBytes.lines {
            try Task.checkCancellation()
            guard line.hasPrefix("data: ") else { continue }
            let jsonStr = String(line.dropFirst(6))
            guard let event = ChatSSEEvent.parse(from: jsonStr) else { continue }
            handleSSEEvent(event)
        }
        // Safety net: ensure UI is always cleaned up if done event was missed
        finalizeStream()
    }

    private func handleSSEEvent(_ event: ChatSSEEvent) {
        switch event {
        case .threadCreated(let threadId, let title):
            currentThreadId = threadId
            // Signal the view to add the user message bubble and update nav state
            createdThread = (id: threadId, title: title)

        case .delta(let content):
            isShowingTypingIndicator = false
            activeStreamingToolName = nil
            streamingContent += content

        case .toolCall(let toolName, _):
            isShowingTypingIndicator = false
            activeStreamingToolName = toolName

        case .done(let messageId):
            let finalMessage = ChatMessage(
                id: messageId,
                threadId: currentThreadId,
                role: "assistant",
                content: streamingContent,
                createdAt: Date()
            )
            messages.append(finalMessage)
            finalizeStream()

        case .error(let message):
            errorMessage = message
            finalizeStream()
        }
    }

    private func finalizeStream() {
        isStreaming = false
        isShowingTypingIndicator = false
        streamingContent = ""
        activeStreamingToolName = nil
    }
}
