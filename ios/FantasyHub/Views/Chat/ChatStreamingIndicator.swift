import SwiftUI

/// Animated three-dot typing indicator shown at the start of an assistant
/// turn, before any delta tokens have arrived.
struct ChatStreamingIndicator: View {
    @State private var phase: Int = 0

    private let timer = Timer.publish(every: 0.35, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(alignment: .top, spacing: Theme.spacingSM) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 28, height: 28)
                .background(Theme.accent.opacity(0.15))
                .clipShape(Circle())
                .padding(.top, 2)

            HStack(spacing: 5) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Theme.accent)
                        .frame(width: 7, height: 7)
                        .scaleEffect(phase == index ? 1.3 : 0.8)
                        .opacity(phase == index ? 1.0 : 0.4)
                        .animation(.easeInOut(duration: 0.3), value: phase)
                }
            }
            .padding(.horizontal, Theme.spacingMD)
            .padding(.vertical, Theme.spacingMD)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))

            Spacer(minLength: Theme.spacingXL)
        }
        .onReceive(timer) { _ in
            phase = (phase + 1) % 3
        }
    }
}
