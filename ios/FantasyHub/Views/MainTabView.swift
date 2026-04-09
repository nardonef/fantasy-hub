import SwiftUI

// MARK: - Tab Bar Hidden Preference Key
// Child views set this to true to hide the custom tab bar.
// PreferenceKey flows UP from child to parent — the correct
// SwiftUI pattern for child-to-parent communication.

struct TabBarHiddenKey: PreferenceKey {
    static let defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) {
        value = value || nextValue()
    }
}

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var selectedTab: Tab = .dashboard
    @State private var isTabBarVisible = true

    enum Tab: String {
        case dashboard, analytics, chat, league, profile
    }

    init() {
        // Fully remove the system UITabBar from the view hierarchy and layout.
        // .toolbar(.hidden) only hides it visually but keeps the layout footprint;
        // this eliminates it entirely so our VStack layout is clean.
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $selectedTab) {
                DashboardView()
                    .tag(Tab.dashboard)

                AnalyticsView()
                    .tag(Tab.analytics)

                ChatLandingView()
                    .tag(Tab.chat)

                LeagueView()
                    .tag(Tab.league)

                ProfileView()
                    .tag(Tab.profile)
            }
            .tabViewStyle(.automatic)
            .tint(Theme.accent)
            .onPreferenceChange(TabBarHiddenKey.self) { hidden in
                isTabBarVisible = !hidden
            }

            if isTabBarVisible {
                CustomTabBar(selectedTab: $selectedTab)
            }
        }
        .background(Theme.background)
        .task {
            await leagueStore.loadLeagues()
        }
        .fullScreenCover(isPresented: showOnboarding) {
            OnboardingView()
                .environmentObject(authManager)
                .environmentObject(leagueStore)
        }
        .fullScreenCover(isPresented: showLoadError) {
            LeagueLoadErrorView {
                Task { await leagueStore.loadLeagues() }
            }
            .environmentObject(leagueStore)
        }
    }

    /// Only show onboarding when the load succeeded but returned no leagues.
    /// A failed fetch (error != nil) is handled separately by showLoadError.
    private var showOnboarding: Binding<Bool> {
        Binding(
            get: { leagueStore.hasAttemptedLoad && !leagueStore.hasLeagues && leagueStore.error == nil },
            set: { _ in }
        )
    }

    /// Show a recoverable error screen when the league fetch fails.
    private var showLoadError: Binding<Bool> {
        Binding(
            get: { leagueStore.hasAttemptedLoad && leagueStore.error != nil },
            set: { _ in }
        )
    }
}

// MARK: - Custom Tab Bar

struct CustomTabBar: View {
    @Binding var selectedTab: MainTabView.Tab

    private let tabs: [(MainTabView.Tab, String, String)] = [
        (.dashboard, "Dashboard", "rectangle.3.group"),
        (.analytics, "Analytics", "chart.bar.xaxis"),
        (.chat, "AI Chat", "bubble.left.and.text.bubble.right"),
        (.league, "League", "person.3"),
        (.profile, "Profile", "person.crop.circle"),
    ]

    var body: some View {
        HStack {
            ForEach(tabs, id: \.0) { tab, label, icon in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: icon)
                            .font(.system(size: 20))
                        Text(label)
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundStyle(selectedTab == tab ? Theme.accent : Theme.dimText)
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(
            Theme.darkSurface
                .ignoresSafeArea(edges: .bottom)
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 0.5)
        }
    }
}
