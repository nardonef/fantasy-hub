import SwiftUI

/// Vertical stack of prompt cards shown in the idle chat state.
/// Tapping a chip fills the input and auto-sends.
struct SuggestedPromptChips: View {
    let onSelect: (String) -> Void

    private let prompts = [
        "Who had the best draft?",
        "Show the all-time league records",
        "Compare two managers head-to-head",
        "What were the biggest trades?",
    ]

    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            ForEach(prompts, id: \.self) { prompt in
                Button {
                    onSelect(prompt)
                } label: {
                    HStack {
                        Text(prompt)
                            .font(Theme.bodyFont)
                            .foregroundStyle(Theme.textPrimary)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        Image(systemName: "arrow.up.circle")
                            .font(.system(size: 18))
                            .foregroundStyle(Theme.accentMuted)
                    }
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.vertical, Theme.spacingMD)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusMD)
                            .stroke(Theme.borderGold, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Theme.spacingMD)
    }
}
