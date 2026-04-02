import SwiftUI

// MARK: - Shimmer Effect Modifier

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1.0

    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { geo in
                    let width = geo.size.width
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0),
                            .init(color: .white.opacity(0.08), location: 0.4),
                            .init(color: .white.opacity(0.14), location: 0.5),
                            .init(color: .white.opacity(0.08), location: 0.6),
                            .init(color: .clear, location: 1),
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: width * 1.5)
                    .offset(x: width * phase)
                }
                .clipped()
            }
            .onAppear {
                withAnimation(
                    .linear(duration: 1.4)
                    .repeatForever(autoreverses: false)
                ) {
                    phase = 1.5
                }
            }
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Shimmer Block

enum ShimmerShape {
    case rectangle
    case circle
    case capsule
}

struct ShimmerBlock: View {
    var width: CGFloat? = nil
    var height: CGFloat = 16
    var shape: ShimmerShape = .rectangle

    var body: some View {
        Group {
            switch shape {
            case .rectangle:
                RoundedRectangle(cornerRadius: Theme.radiusSM)
                    .fill(Theme.surface)
                    .frame(width: width, height: height)
            case .circle:
                Circle()
                    .fill(Theme.surface)
                    .frame(width: height, height: height)
            case .capsule:
                Capsule()
                    .fill(Theme.surface)
                    .frame(width: width, height: height)
            }
        }
        .shimmer()
    }
}
