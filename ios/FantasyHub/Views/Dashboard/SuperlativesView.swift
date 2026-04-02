import SwiftUI

struct SuperlativesView: View {
    let superlatives: [Superlative]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("YOUR LEGACY")
                .sectionHeaderStyle()

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(superlatives) { superlative in
                        SuperlativeBadgeCard(superlative: superlative)
                    }
                }
            }
        }
    }
}

struct SuperlativeBadgeCard: View {
    let superlative: Superlative

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Image(systemName: superlative.icon)
                .font(.system(size: 16))
                .foregroundStyle(Theme.accent)

            Text(superlative.title.uppercased())
                .font(Theme.captionFont)
                .foregroundStyle(Theme.accent)
                .tracking(1.0)
                .lineLimit(1)

            Text(superlative.stat)
                .font(Theme.tabularFont)
                .foregroundStyle(Theme.textPrimary)

            Text(superlative.detail)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.dimText)
                .lineLimit(2)
        }
        .frame(width: 130, alignment: .leading)
        .padding(Theme.spacingMD)
        .cardStyle()
    }
}
