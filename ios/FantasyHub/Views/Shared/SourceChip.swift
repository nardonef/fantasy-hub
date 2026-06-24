import SwiftUI

/// Small pill showing a source kind glyph + label. Used in briefing and player detail.
struct SourceChip: View {
    let source: SourceReference

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: source.kind.chipIcon)
                .font(.system(size: 10, weight: .semibold))
            Text(source.label)
                .font(.system(size: 10, weight: .semibold))
        }
        .foregroundStyle(Theme.textDim)
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Theme.warmCream.opacity(0.06))
        .overlay(
            RoundedRectangle(cornerRadius: 999)
                .stroke(Theme.hairline, lineWidth: 0.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 999))
    }
}
