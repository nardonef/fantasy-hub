import SwiftUI

struct RivalCard: View {
    let title: String
    let rival: RivalRecord
    let isBest: Bool

    private var totalGames: Int { rival.wins + rival.losses }
    private var winPct: Double {
        totalGames > 0 ? Double(rival.wins) / Double(totalGames) : 0.5
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack {
                Image(systemName: isBest ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(isBest ? Theme.win : Theme.loss)

                Text(title.uppercased())
                    .font(Theme.captionFont)
                    .foregroundStyle(isBest ? Theme.win : Theme.loss)
                    .tracking(1.0)
            }

            Text(rival.name)
                .font(Theme.titleFont)
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)

            HStack(spacing: Theme.spacingSM) {
                Text("\(rival.wins)-\(rival.losses)")
                    .font(Theme.tabularFont)
                    .foregroundStyle(isBest ? Theme.win : Theme.loss)

                GeometryReader { geo in
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(Theme.win)
                            .frame(width: geo.size.width * winPct)
                        Rectangle()
                            .fill(Theme.loss)
                    }
                    .clipShape(Capsule())
                }
                .frame(height: 6)
            }
        }
        .padding(Theme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}
