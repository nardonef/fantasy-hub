import SwiftUI

// MARK: - Dashboard Skeleton

struct DashboardSkeleton: View {
    var body: some View {
        VStack(spacing: Theme.spacingLG) {
            // Header card placeholder
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                HStack {
                    ShimmerBlock(width: 180, height: 20)
                    Spacer()
                    ShimmerBlock(width: 60, height: 24, shape: .capsule)
                }

                HStack(spacing: Theme.spacingMD) {
                    ForEach(0..<3, id: \.self) { _ in
                        VStack(spacing: 2) {
                            ShimmerBlock(width: 36, height: 16)
                            ShimmerBlock(width: 48, height: 10)
                        }
                    }
                }
            }
            .padding(Theme.spacingMD)
            .cardStyle()

            // Standings placeholder
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                ShimmerBlock(width: 100, height: 12)

                ForEach(0..<5, id: \.self) { _ in
                    HStack {
                        ShimmerBlock(width: 24, height: 14)
                        ShimmerBlock(width: 120, height: 14)
                        Spacer()
                        ShimmerBlock(width: 50, height: 14)
                        ShimmerBlock(width: 44, height: 12)
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding(Theme.spacingMD)
            .cardStyle()

            // Activity feed placeholder
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                ShimmerBlock(width: 130, height: 12)

                VStack(spacing: 0) {
                    ForEach(0..<4, id: \.self) { index in
                        HStack(spacing: Theme.spacingSM) {
                            ShimmerBlock(height: 28, shape: .circle)

                            VStack(alignment: .leading, spacing: 4) {
                                ShimmerBlock(width: 160, height: 14)
                                ShimmerBlock(width: 100, height: 10)
                            }

                            Spacer()

                            ShimmerBlock(width: 30, height: 10)
                        }
                        .padding(Theme.spacingMD)

                        if index < 3 {
                            Divider().background(Theme.surface)
                        }
                    }
                }
                .cardStyle()
            }

            // Stats grid placeholder
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                ShimmerBlock(width: 120, height: 12)

                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                ], spacing: Theme.spacingSM) {
                    ForEach(0..<4, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: Theme.spacingSM) {
                            ShimmerBlock(height: 16, shape: .circle)
                            ShimmerBlock(width: 48, height: 24)
                            ShimmerBlock(width: 80, height: 10)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Theme.spacingMD)
                        .cardStyle()
                    }
                }
            }
        }
        .padding(Theme.spacingMD)
    }
}

// MARK: - Analytics Skeleton

struct AnalyticsSkeleton: View {
    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Filter bar placeholder
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Theme.spacingSM) {
                            ForEach(0..<5, id: \.self) { _ in
                                ShimmerBlock(width: 64, height: 32, shape: .capsule)
                            }
                        }
                    }
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.bottom, Theme.spacingMD)

                    VStack(spacing: Theme.spacingLG) {
                        // Summary grid placeholder
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.spacingSM) {
                            ForEach(0..<4, id: \.self) { _ in
                                VStack(spacing: Theme.spacingSM) {
                                    ShimmerBlock(height: 16, shape: .circle)
                                    ShimmerBlock(width: 48, height: 24)
                                    ShimmerBlock(width: 72, height: 10)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(Theme.spacingMD)
                                .cardStyle()
                            }
                        }

                        // Section cards with bar chart placeholders
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonSectionCard()
                        }
                    }
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.bottom, 100)
                }
            }
        }
    }
}

private struct SkeletonSectionCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Section header
            HStack {
                ShimmerBlock(height: 14, shape: .circle)
                ShimmerBlock(width: 140, height: 12)
                Spacer()
                ShimmerBlock(width: 48, height: 12)
            }

            // Card content — bar chart placeholder rows
            VStack(spacing: 0) {
                ForEach(0..<4, id: \.self) { index in
                    HStack {
                        ShimmerBlock(width: 24, height: 14)
                        ShimmerBlock(width: 100, height: 14)
                        Spacer()
                        ShimmerBlock(width: 50, height: 14)
                    }
                    .padding(.vertical, Theme.spacingSM)
                    .padding(.horizontal, Theme.spacingMD)

                    if index < 3 {
                        Divider().background(Theme.surface)
                    }
                }
            }
            .cardStyle()
        }
    }
}

// MARK: - Standings Skeleton

struct StandingsSkeleton: View {
    var rowCount: Int = 10

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Theme.spacingLG) {
                    // Tab picker placeholder
                    ShimmerBlock(height: 32)
                        .padding(.horizontal, Theme.spacingMD)

                    // Table header
                    HStack {
                        ShimmerBlock(width: 20, height: 10)
                        ShimmerBlock(width: 64, height: 10)
                        Spacer()
                        ShimmerBlock(width: 44, height: 10)
                        ShimmerBlock(width: 50, height: 10)
                        ShimmerBlock(width: 50, height: 10)
                    }
                    .padding(.horizontal, Theme.spacingMD)

                    // Table rows
                    VStack(spacing: 0) {
                        ForEach(0..<rowCount, id: \.self) { index in
                            HStack {
                                ShimmerBlock(width: 24, height: 14)

                                HStack(spacing: Theme.spacingSM) {
                                    ShimmerBlock(height: 28, shape: .circle)
                                    ShimmerBlock(width: 100, height: 14)
                                }

                                Spacer()

                                ShimmerBlock(width: 50, height: 14)
                                ShimmerBlock(width: 50, height: 12)
                                ShimmerBlock(width: 50, height: 12)
                            }
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.vertical, 10)
                            .background(index % 2 == 0 ? Theme.card : Theme.darkSurface)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .padding(.vertical, Theme.spacingMD)
            }
        }
    }
}

// MARK: - Generic List Skeleton

struct GenericListSkeleton: View {
    var rowCount: Int = 8

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Theme.spacingSM) {
                    ForEach(0..<rowCount, id: \.self) { _ in
                        HStack(spacing: Theme.spacingSM) {
                            ShimmerBlock(width: 24, height: 14)

                            VStack(alignment: .leading, spacing: 4) {
                                ShimmerBlock(width: 140, height: 14)
                                ShimmerBlock(width: 90, height: 10)
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 4) {
                                ShimmerBlock(width: 48, height: 20)
                                ShimmerBlock(width: 36, height: 10)
                            }
                        }
                        .padding(Theme.spacingMD)
                        .cardStyle()
                    }
                }
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, Theme.spacingMD)
            }
        }
    }
}
