import SwiftUI

struct ErrorStateView: View {
    var icon: String = "exclamationmark.triangle"
    var title: String = "Something Went Wrong"
    var message: String
    var onRetry: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(Theme.loss.opacity(0.8))

            Text(title)
                .font(Theme.titleFont)
                .foregroundStyle(Theme.textPrimary)

            Text(message)
                .font(Theme.captionFont)
                .foregroundStyle(Theme.dimText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)

            if let onRetry {
                Button(action: onRetry) {
                    HStack(spacing: Theme.spacingSM) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Try Again")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.accent)
                    .foregroundStyle(Theme.charcoal)
                    .clipShape(Capsule())
                }
                .padding(.top, Theme.spacingSM)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.spacingXL)
    }
}
