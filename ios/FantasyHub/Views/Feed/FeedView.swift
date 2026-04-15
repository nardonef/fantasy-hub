import SwiftUI

struct FeedView: View {
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var section: FeedSection = .feed
    @State private var sourceFilter: SignalSource? = nil
    @State private var typeFilter: SignalType? = nil
    @State private var positionFilter: String? = nil
    @State private var myRosterOnly: Bool = true
    @State private var myManager: Manager? = nil
    @State private var isRefreshingRoster = false
    @State private var signals: [Signal] = []
    @State private var nextCursor: String? = nil
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var recommendations: [RecommendationItem] = []
    @State private var isLoadingRecs = false
    @State private var errorMessage: String? = nil
    @State private var searchText = ""
    @State private var searchResults: [PlayerSearchResult] = []
    @State private var isSearching = false
    @State private var selectedPlayerId: String? = nil
    @State private var selectedPlayerName: String? = nil
    @State private var showNoManagerAlert = false
    @State private var loadedLeagueId: String? = nil

    private let positions = ["QB", "RB", "WR", "TE", "K"]

    enum FeedSection: String, CaseIterable {
        case feed = "Feed"
        case picks = "Picks"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Section toggle
                HStack(spacing: 0) {
                    ForEach(FeedSection.allCases, id: \.self) { s in
                        Button {
                            withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                                section = s
                            }
                        } label: {
                            Text(s.rawValue)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(section == s ? Theme.background : Theme.textSecondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(
                                    Group {
                                        if section == s {
                                            Theme.accent.clipShape(Capsule())
                                        }
                                    }
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(3)
                .background(Color.white.opacity(0.1), in: Capsule())
                .padding(.horizontal, Theme.spacingXL)
                .padding(.vertical, Theme.spacingSM)

                if section == .feed {
                    feedContent
                } else {
                    picksContent
                }
            }
            .background(Theme.background)
            .navigationTitle("Intelligence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
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
                let leagueId = leagueStore.activeLeagueId
                // Tab re-appear with same league and data already loaded — do nothing
                guard leagueId != loadedLeagueId || signals.isEmpty else { return }
                loadedLeagueId = leagueId
                myManager = nil
                signals = []
                nextCursor = nil
                recommendations = []
                // Use prefetched data if available — no loading state, no flash
                if let prefetched = leagueStore.consumePrefetchedFeed() {
                    myManager = prefetched.manager
                    signals = prefetched.signals
                    nextCursor = prefetched.cursor
                    return
                }
                // Prefetch not ready yet — load normally
                if let leagueId {
                    myManager = try? await APIClient.shared.getMyManager(leagueId: leagueId)
                    if myRosterOnly, myManager != nil {
                        isRefreshingRoster = true
                        try? await APIClient.shared.refreshRoster(leagueId: leagueId)
                        isRefreshingRoster = false
                    }
                }
                await loadSection()
            }
            .onChange(of: section) {
                Task { await loadSection() }
            }
            .onChange(of: sourceFilter) {
                Task { if section == .feed { await loadFeed(reset: true) } }
            }
            .onChange(of: typeFilter) {
                Task { if section == .feed { await loadFeed(reset: true) } }
            }
            .onChange(of: positionFilter) {
                Task { if section == .feed { await loadFeed(reset: true) } }
            }
            .onChange(of: myRosterOnly) {
                Task {
                    guard section == .feed else { return }
                    if myRosterOnly, let leagueId = leagueStore.activeLeague?.id, myManager != nil {
                        isRefreshingRoster = true
                        try? await APIClient.shared.refreshRoster(leagueId: leagueId)
                        isRefreshingRoster = false
                    }
                    await loadFeed(reset: true)
                }
            }
            .alert("Claim Your Team", isPresented: $showNoManagerAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Go to the Dashboard tab and claim your manager profile to filter signals by your current roster.")
            }
        }
    }

    // MARK: - Feed Section

    private var feedContent: some View {
        VStack(spacing: 0) {
            filterChips
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, Theme.spacingSM)

            if isLoading && signals.isEmpty {
                FeedSkeleton()
            } else if let error = errorMessage {
                ErrorStateView(message: error) {
                    errorMessage = nil
                    Task { await loadFeed(reset: true) }
                }
                .padding(Theme.spacingLG)
            } else if signals.isEmpty {
                emptyFeed
            } else {
                ScrollView {
                    LazyVStack(spacing: Theme.spacingSM) {
                        ForEach(signals) { signal in
                            NavigationLink {
                                PlayerDetailView(playerId: signal.player.id, playerName: signal.player.fullName)
                            } label: {
                                SignalCard(signal: signal)
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, Theme.spacingMD)
                            .onAppear {
                                if signal.id == signals.last?.id {
                                    Task { await loadMore() }
                                }
                            }
                        }

                        if isLoadingMore {
                            ProgressView()
                                .tint(Theme.accent)
                                .padding()
                        }
                    }
                    .padding(.vertical, Theme.spacingMD)
                }
            }
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.spacingSM) {
                // Roster scope toggle
                if myManager != nil {
                    FeedFilterChip(
                        label: isRefreshingRoster ? "Syncing…" : "My Team",
                        icon: isRefreshingRoster ? "arrow.triangle.2.circlepath" : "person.fill",
                        color: Theme.accent,
                        isActive: myRosterOnly
                    ) {
                        myRosterOnly.toggle()
                    }
                    .disabled(isRefreshingRoster)
                } else {
                    FeedFilterChip(
                        label: "My Team",
                        icon: "person.slash",
                        color: Theme.textSecondary,
                        isActive: false
                    ) {
                        showNoManagerAlert = true
                    }
                }

                Divider()
                    .frame(height: 20)
                    .background(Color.white.opacity(0.15))

                // Position chips
                ForEach(positions, id: \.self) { pos in
                    FeedFilterChip(label: pos, isActive: positionFilter == pos) {
                        positionFilter = positionFilter == pos ? nil : pos
                    }
                }

                Divider()
                    .frame(height: 20)
                    .background(Color.white.opacity(0.15))

                // Signal type chips
                FeedFilterChip(label: "Rankings", icon: "arrow.up.arrow.down", isActive: typeFilter == .rankingChange) {
                    typeFilter = typeFilter == .rankingChange ? nil : .rankingChange
                    sourceFilter = nil
                }
                FeedFilterChip(label: "Stats", icon: "chart.bar.fill", isActive: typeFilter == .statsUpdate) {
                    typeFilter = typeFilter == .statsUpdate ? nil : .statsUpdate
                    sourceFilter = nil
                }
                FeedFilterChip(label: "Social", icon: "bubble.left", isActive: typeFilter == .socialMention) {
                    typeFilter = typeFilter == .socialMention ? nil : .socialMention
                    sourceFilter = nil
                }

                Divider()
                    .frame(height: 20)
                    .background(Color.white.opacity(0.15))

                // Source chips
                ForEach(SignalSource.allCases, id: \.self) { src in
                    FeedFilterChip(label: src.displayName, color: src.accentColor, isActive: sourceFilter == src) {
                        sourceFilter = sourceFilter == src ? nil : src
                        typeFilter = nil
                    }
                }
            }
        }
    }

    private var emptyFeed: some View {
        VStack(spacing: Theme.spacingMD) {
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.system(size: 40))
                .foregroundStyle(Theme.textSecondary)
            Text("No signals yet")
                .font(Theme.headlineFont)
                .foregroundStyle(Theme.textPrimary)
            Text("Signals appear here as data is ingested twice daily.")
                .font(Theme.bodyFont)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Theme.spacingXL)
    }

    // MARK: - Picks Section

    private var picksContent: some View {
        Group {
            if isLoadingRecs && recommendations.isEmpty {
                FeedSkeleton()
            } else if recommendations.isEmpty {
                VStack(spacing: Theme.spacingMD) {
                    Image(systemName: "star.slash")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.textSecondary)
                    Text("No picks yet")
                        .font(Theme.headlineFont)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Picks surface when players have signals from multiple sources.")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(Theme.spacingXL)
            } else {
                ScrollView {
                    LazyVStack(spacing: Theme.spacingSM) {
                        ForEach(recommendations) { rec in
                            RecommendationCard(item: rec) {
                                selectedPlayerId = rec.player.id
                                selectedPlayerName = rec.player.fullName
                            }
                            .padding(.horizontal, Theme.spacingMD)
                        }
                    }
                    .padding(.vertical, Theme.spacingMD)
                }
                .navigationDestination(isPresented: Binding(
                    get: { selectedPlayerId != nil },
                    set: { if !$0 { selectedPlayerId = nil } }
                )) {
                    if let pid = selectedPlayerId, let pname = selectedPlayerName {
                        PlayerDetailView(playerId: pid, playerName: pname)
                    }
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadSection() async {
        switch section {
        case .feed: await loadFeed(reset: true)
        case .picks: await loadRecommendations()
        }
    }

    private func loadFeed(reset: Bool) async {
        guard let leagueId = leagueStore.activeLeague?.id else { return }
        if reset { signals = []; nextCursor = nil }
        isLoading = true
        errorMessage = nil
        // Only apply roster filter when user has a claimed manager — otherwise it's a no-op on the API
        let applyRosterFilter = myRosterOnly && myManager != nil
        do {
            let response = try await APIClient.shared.getFeed(
                leagueId: leagueId,
                source: sourceFilter,
                type: typeFilter,
                position: positionFilter,
                myRosterOnly: applyRosterFilter,
                limit: 20,
                cursor: reset ? nil : nextCursor
            )
            signals = reset ? response.signals : signals + response.signals
            nextCursor = response.nextCursor
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadMore() async {
        guard nextCursor != nil, !isLoadingMore else { return }
        guard let leagueId = leagueStore.activeLeague?.id else { return }
        isLoadingMore = true
        let applyRosterFilter = myRosterOnly && myManager != nil
        do {
            let response = try await APIClient.shared.getFeed(
                leagueId: leagueId,
                source: sourceFilter,
                type: typeFilter,
                position: positionFilter,
                myRosterOnly: applyRosterFilter,
                limit: 20,
                cursor: nextCursor
            )
            signals += response.signals
            nextCursor = response.nextCursor
        } catch { /* silently ignore pagination errors */ }
        isLoadingMore = false
    }

    private func loadRecommendations() async {
        guard let leagueId = leagueStore.activeLeague?.id else { return }
        isLoadingRecs = true
        do {
            let response = try await APIClient.shared.getRecommendations(leagueId: leagueId)
            recommendations = response.recommendations
        } catch { /* show empty state */ }
        isLoadingRecs = false
    }
}

// MARK: - Feed Filter Chip

struct FeedFilterChip: View {
    let label: String
    var icon: String? = nil
    var color: Color = Color(hex: 0xC9A96E)
    let isActive: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 10))
                }
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(isActive ? Theme.background : Theme.textSecondary)
            .padding(.horizontal, Theme.spacingSM)
            .padding(.vertical, 6)
            .background(isActive ? color : color.opacity(0.0))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(isActive ? Color.clear : Theme.textSecondary.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Feed Skeleton

private struct FeedSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Theme.spacingSM) {
                ForEach(0..<8, id: \.self) { _ in
                    ShimmerBlock(height: 88)
                        .padding(.horizontal, Theme.spacingMD)
                }
            }
            .padding(.vertical, Theme.spacingMD)
        }
    }
}
