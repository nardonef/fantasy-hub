import SwiftUI

/// Input bar fixed at the bottom of ChatThreadView.
/// Disables the send button while the message field is empty or streaming is active.
struct ChatInputBar: View {
    @Binding var text: String
    let isStreaming: Bool
    let onSend: () -> Void
    let onStop: () -> Void

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespaces).isEmpty && !isStreaming
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.spacingSM) {
            TextField("Ask anything about \(isStreaming ? "your league" : "your league")…", text: $text, axis: .vertical)
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .lineLimit(1...6)
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, Theme.spacingSM)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                .disabled(isStreaming)
                .submitLabel(.send)
                .onSubmit {
                    if canSend { onSend() }
                }

            Button {
                if isStreaming {
                    onStop()
                } else {
                    onSend()
                }
            } label: {
                ZStack {
                    if isStreaming {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.background)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(canSend ? Theme.background : Theme.textSecondary)
                    }
                }
                .frame(width: 36, height: 36)
                .background(
                    isStreaming
                        ? Theme.loss
                        : (canSend ? Theme.accent : Theme.card)
                )
                .clipShape(Circle())
                .animation(.easeInOut(duration: 0.15), value: isStreaming)
                .animation(.easeInOut(duration: 0.15), value: canSend)
            }
            .disabled(!isStreaming && !canSend)
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingSM)
        .background(Theme.darkSurface)
    }
}
