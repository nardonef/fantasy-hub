import SwiftUI

struct ChatPlaceholderView: View {
    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "bubble.left.and.text.bubble.right")
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.accent)
                Text("AI Chat")
                    .font(Theme.headlineFont)
                    .foregroundStyle(Theme.textPrimary)
                Text("Coming in V2")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }
}
