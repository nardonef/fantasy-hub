import SwiftUI

/// Horizontal row of filled/empty squircles indicating confidence level (0–max).
struct ConfidenceDots: View {
    let n: Int
    var max: Int = 4
    let tone: Color

    private var label: String {
        switch n {
        case 0: return "None"
        case 1: return "Low"
        case 2: return "Medium"
        case 3: return "High"
        default: return "Very high"
        }
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<max, id: \.self) { i in
                RoundedRectangle(cornerRadius: 3)
                    .fill(i < n ? tone : Theme.hairlineStrong)
                    .frame(width: 5, height: 5)
            }
        }
        .accessibilityLabel("Confidence: \(label), \(n) of \(max)")
    }
}
