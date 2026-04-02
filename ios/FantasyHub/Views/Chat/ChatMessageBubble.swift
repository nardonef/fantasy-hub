import SwiftUI

/// A single message bubble rendered in the chat thread.
/// Handles user (right-aligned gold), assistant (left-aligned card), and
/// tool call indicator (left-aligned subtle) variants.
struct ChatMessageBubble: View {
    let message: ChatMessage

    var body: some View {
        switch message.role {
        case "user":
            userBubble
        case "tool":
            toolCallBubble
        default:
            assistantBubble
        }
    }

    // MARK: - User Bubble

    private var userBubble: some View {
        HStack {
            Spacer(minLength: Theme.spacingXL)
            Text(message.content)
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.background)
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, Theme.spacingSM)
                .background(Theme.accent)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .offset(x: 0, y: 0)
                )
        }
    }

    // MARK: - Assistant Bubble

    private var assistantBubble: some View {
        HStack(alignment: .top, spacing: Theme.spacingSM) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 28, height: 28)
                .background(Theme.accent.opacity(0.15))
                .clipShape(Circle())
                .padding(.top, 2)

            Text(message.content)
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textPrimary)
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, Theme.spacingSM)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

            Spacer(minLength: Theme.spacingXL)
        }
    }

    // MARK: - Tool Call Bubble

    private var toolCallBubble: some View {
        HStack(alignment: .center, spacing: Theme.spacingSM) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.accentMuted)

            if let toolName = message.toolName {
                Text("Looked up \(toolName)…")
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)
            } else {
                Text(message.content)
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)
            }

            Spacer()
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingXS)
        .background(Theme.surface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSM))
    }
}

// MARK: - Streaming Bubble

/// An in-progress assistant bubble that shows partial streamed content
/// with an animated blinking cursor.
struct StreamingMessageBubble: View {
    let content: String

    @State private var cursorOpacity: Double = 1.0

    var body: some View {
        HStack(alignment: .top, spacing: Theme.spacingSM) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 28, height: 28)
                .background(Theme.accent.opacity(0.15))
                .clipShape(Circle())
                .padding(.top, 2)

            HStack(spacing: 0) {
                Text(content)
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textPrimary)
                // Blinking cursor
                Rectangle()
                    .fill(Theme.accent)
                    .frame(width: 2, height: 16)
                    .opacity(cursorOpacity)
                    .animation(
                        .easeInOut(duration: 0.5).repeatForever(autoreverses: true),
                        value: cursorOpacity
                    )
            }
            .padding(.horizontal, Theme.spacingMD)
            .padding(.vertical, Theme.spacingSM)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

            Spacer(minLength: Theme.spacingXL)
        }
        .onAppear {
            cursorOpacity = 0
        }
    }
}
