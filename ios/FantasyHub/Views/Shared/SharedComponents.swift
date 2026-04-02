import SwiftUI

// MARK: - Loading View

struct LoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: Theme.spacingMD) {
                ProgressView()
                    .controlSize(.large)
                    .tint(Theme.accent)
                Text(message)
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.dimText)
            }
        }
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionLabel: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(Theme.accent.opacity(0.5))

            Text(title)
                .font(Theme.titleFont)
                .foregroundStyle(Theme.textPrimary)

            Text(message)
                .font(Theme.captionFont)
                .foregroundStyle(Theme.dimText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)

            if let actionLabel, let action {
                Button(action: action) {
                    Text(actionLabel)
                        .font(.system(size: 14, weight: .semibold))
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

// MARK: - Settings Row

struct SettingsRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    var detail: String? = nil

    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(iconColor)
                .frame(width: 28)

            Text(title)
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textPrimary)

            Spacer()

            if let detail {
                Text(detail)
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.dimText)
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.dimText)
        }
        .padding(Theme.spacingMD)
    }
}
