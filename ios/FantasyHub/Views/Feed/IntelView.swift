import SwiftUI

private enum IntelTab {
    case myTeam, acrossLeague
}

/// Personalized intelligence hub. Two tabs:
///   1. My Team   — action items + player-grouped roster signals
///   2. Across the League — filtered, paginated league-wide signal feed
struct IntelView: View {
    @EnvironmentObject var leagueStore: LeagueStore

    @State private var selectedTab: IntelTab = .myTeam
    @State private var intelligence: IntelligenceResponse? = nil
    @State private var briefing: TodaysBriefingResponse? = nil
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var errorMessage: String? = nil
    @State private var leagueSignalsCursor: String? = nil
    @State private var allLeagueSignals: [Signal] = []

    // Filter state for "Across the League"
    @State private var sourceFilter: SignalSource? = nil
    @State private var typeFilter: SignalType? = nil
    @State private var positionFilter: String? = nil
    @State private var myRosterOnly: Bool = true

    @State private var loadedLeagueId: String? = nil

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && intelligence == nil {
                    IntelSkeleton()
                } else if let error = errorMessage {
                    ErrorStateView(message: error) {
                        errorMessage = nil
                        Task { await loadIntelligence(reset: true) }
                    }
                    .padding(Theme.spacingLG)
                } else {
                    VStack(spacing: 0) {
                        tabControl
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.vertical, Theme.spacingSM)

                        tabContent
                    }
                }
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    LeagueSwitcher()
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink {
                        PlayerSearchView()
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
            .task(id: leagueStore.activeLeagueId) {
                guard leagueStore.activeLeagueId != loadedLeagueId || intelligence == nil else { return }
                loadedLeagueId = leagueStore.activeLeagueId
                intelligence = nil
                briefing = nil
                allLeagueSignals = []
                leagueSignalsCursor = nil
                await loadIntelligence(reset: true)
            }
            .onChange(of: sourceFilter) { Task { await loadIntelligence(reset: true) } }
            .onChange(of: typeFilter) { Task { await loadIntelligence(reset: true) } }
            .onChange(of: positionFilter) { Task { await loadIntelligence(reset: true) } }
            .onChange(of: myRosterOnly) { Task { await loadIntelligence(reset: true) } }
        }
    }

    // MARK: - Tab Control

    private var tabControl: some View {
        HStack(spacing: 4) {
            tabButton(title: "MY TEAM", tab: .myTeam)
            tabButton(title: "ACROSS THE LEAGUE", tab: .acrossLeague)
        }
        .padding(3)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func tabButton(title: String, tab: IntelTab) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                selectedTab = tab
            }
        } label: {
            Text(title)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(selectedTab == tab ? Theme.background : Theme.textSecondary)
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, 7)
                .frame(maxWidth: .infinity)
                .background(
                    selectedTab == tab
                        ? Theme.accent
                        : Color.clear
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    // MARK: - Tab Content

    @ViewBuilder
    private var tabContent: some View {
        if selectedTab == .myTeam {
            IntelMyTeamView(
                briefing: briefing,
                rosterNews: intelligence?.rosterNews ?? [],
                isLoading: isLoading,
                isInitialLoad: intelligence == nil && briefing == nil,
                onRefresh: { await loadIntelligence(reset: true) }
            )
        } else {
            IntelAcrossLeagueView(
                signals: allLeagueSignals,
                isLoading: isLoading,
                isLoadingMore: isLoadingMore,
                sourceFilter: $sourceFilter,
                typeFilter: $typeFilter,
                positionFilter: $positionFilter,
                myRosterOnly: $myRosterOnly,
                onRefresh: { await loadIntelligence(reset: true) },
                onLoadMore: { await loadMoreLeagueSignals() }
            )
        }
    }

    // MARK: - Data Loading

    private func loadIntelligence(reset: Bool) async {
        guard let leagueId = leagueStore.activeLeague?.id else { return }
        if reset {
            allLeagueSignals = []
            leagueSignalsCursor = nil
        }
        isLoading = true
        errorMessage = nil
        do {
            async let intelligenceResult = APIClient.shared.fetchIntelligence(
                leagueId: leagueId,
                weekOpponent: true,
                myRosterOnly: myRosterOnly,
                limit: 20
            )
            async let briefingResult = APIClient.shared.fetchBriefing(leagueId: leagueId)
            let response = try await intelligenceResult
            intelligence = response
            briefing = try? await briefingResult
            if reset {
                allLeagueSignals = response.leagueSignals
            } else {
                allLeagueSignals += response.leagueSignals
            }
            leagueSignalsCursor = response.nextCursor
        } catch is CancellationError {
            // Refresh task was cancelled (view changed mid-flight) — not an error
        } catch let urlError as URLError where urlError.code == .cancelled {
            // URLSession task cancelled for the same reason — not an error
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadMoreLeagueSignals() async {
        guard let cursor = leagueSignalsCursor, !isLoadingMore else { return }
        guard let leagueId = leagueStore.activeLeague?.id else { return }
        isLoadingMore = true
        do {
            let response = try await APIClient.shared.fetchIntelligence(
                leagueId: leagueId,
                limit: 20,
                cursor: cursor
            )
            allLeagueSignals += response.leagueSignals
            leagueSignalsCursor = response.nextCursor
        } catch { /* silently ignore pagination errors */ }
        isLoadingMore = false
    }
}

// MARK: - Skeleton

private struct IntelSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingLG) {
            ShimmerBlock(height: 36)
                .padding(.horizontal, Theme.spacingMD)
            VStack(spacing: Theme.spacingSM) {
                ShimmerBlock(width: 120, height: 16)
                    .padding(.horizontal, Theme.spacingMD)
                ShimmerBlock(height: 56)
                    .padding(.horizontal, Theme.spacingMD)
                ShimmerBlock(height: 56)
                    .padding(.horizontal, Theme.spacingMD)
            }
            VStack(spacing: Theme.spacingSM) {
                ShimmerBlock(width: 100, height: 16)
                    .padding(.horizontal, Theme.spacingMD)
                ForEach(0..<3, id: \.self) { _ in
                    ShimmerBlock(height: 140)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
        }
        .padding(.vertical, Theme.spacingMD)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
