import SwiftUI

/// Broadcast Dark + Trophy Gold design system
enum Theme {
    // MARK: - Core Palette
    static let charcoal = Color(hex: 0x1A1A1A)
    static let darkSurface = Color(hex: 0x242424)
    static let cardSurface = Color(hex: 0x2A2A2A)
    static let warmCream = Color(hex: 0xE8E2D6)
    static let oldGold = Color(hex: 0xC9A96E)
    static let mutedGold = Color(hex: 0x9A7D4E)
    static let dimText = Color(hex: 0x8A8578)

    // MARK: - Semantic Colors
    static let background = charcoal
    static let surface = darkSurface
    static let card = cardSurface
    static let textPrimary = warmCream
    static let textSecondary = dimText
    static let accent = oldGold
    static let accentMuted = mutedGold

    // MARK: - Elevation Surfaces
    static let bgElev1 = Color(hex: 0x1C1A17)
    static let bgElev2 = Color(hex: 0x24211D)

    // MARK: - Opacity Scale
    static let textDim    = warmCream.opacity(0.62)
    static let textFaint  = warmCream.opacity(0.38)
    static let hairline         = warmCream.opacity(0.08)
    static let hairlineStrong   = warmCream.opacity(0.14)

    // MARK: - Status Colors
    static let win  = Color(hex: 0x6FBF8A)
    static let loss = Color(hex: 0xD96B6B)
    static let tie  = Color(hex: 0xD6B461)
    static let info = Color(hex: 0x7FA8C9)
    static let positive = win
    static let negative = loss

    // MARK: - Heatmap & Visual Hierarchy
    static let heatmapEmpty = Color(hex: 0x333333)
    static let borderGold = oldGold.opacity(0.2)

    /// Returns a color on a red→neutral→green gradient based on win percentage (0.0–1.0)
    static func winRateColor(_ winPct: Double) -> Color {
        let clamped = max(0, min(1, winPct))
        if clamped < 0.5 {
            // 0.0 = full loss, 0.5 = neutral
            let t = clamped / 0.5
            return Color(
                red: 0.973 * (1 - t) + 0.333 * t,
                green: 0.443 * (1 - t) + 0.333 * t,
                blue: 0.443 * (1 - t) + 0.333 * t
            )
        } else {
            // 0.5 = neutral, 1.0 = full win
            let t = (clamped - 0.5) / 0.5
            return Color(
                red: 0.333 * (1 - t) + 0.290 * t,
                green: 0.333 * (1 - t) + 0.871 * t,
                blue: 0.333 * (1 - t) + 0.502 * t
            )
        }
    }

    // MARK: - Typography
    static let displayFont: Font = .system(size: 28, weight: .bold, design: .default)
    static let headlineFont: Font = .system(size: 20, weight: .bold, design: .default)
    static let titleFont: Font = .system(size: 17, weight: .semibold, design: .default)
    static let bodyFont: Font = .system(size: 15, weight: .regular, design: .default)
    static let captionFont: Font = .system(size: 12, weight: .medium, design: .default)
    static let statFont: Font = .system(size: 24, weight: .bold, design: .monospaced)
    static let tabularFont: Font = .system(size: 15, weight: .semibold, design: .monospaced)
    static let numDisplay: Font = .system(size: 32, weight: .semibold, design: .monospaced)
    static let numStat: Font = .system(size: 18, weight: .semibold, design: .monospaced)

    // MARK: - Spacing
    static let spacingXS: CGFloat = 4
    static let spacingSM: CGFloat = 8
    static let spacingMD: CGFloat = 16
    static let spacingLG: CGFloat = 24
    static let spacingXL: CGFloat = 32

    // MARK: - Radii
    static let radiusSM: CGFloat = 8
    static let radiusMD: CGFloat = 12
    static let radiusLG: CGFloat = 16
    static let radiusXL: CGFloat = 20
}

// MARK: - Color Extension

extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}

// MARK: - View Modifiers

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
    }
}

struct SectionHeaderStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Theme.captionFont)
            .foregroundStyle(Theme.accent)
            .textCase(.uppercase)
            .tracking(1.2)
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardStyle())
    }

    func sectionHeaderStyle() -> some View {
        modifier(SectionHeaderStyle())
    }

    func rankAccentStyle(rank: Int) -> some View {
        modifier(RankAccentModifier(rank: rank))
    }
}

struct RankAccentModifier: ViewModifier {
    let rank: Int

    func body(content: Content) -> some View {
        HStack(spacing: 0) {
            if rank <= 3 {
                Rectangle()
                    .fill(rank == 1 ? Theme.accent : Theme.borderGold)
                    .frame(width: rank == 1 ? 4 : 3)
            }
            content
        }
    }
}
