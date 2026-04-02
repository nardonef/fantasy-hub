import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var leagueStore: LeagueStore
    @State private var selectedTab: Tab = .dashboard

    enum Tab: String {
        case dashboard, analytics, chat, league, profile
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                DashboardView()
                    .tag(Tab.dashboard)

                AnalyticsView()
                    .tag(Tab.analytics)

                ChatTabView()
                    .tag(Tab.chat)

                LeagueView()
                    .tag(Tab.league)

                ProfileView()
                    .tag(Tab.profile)
            }
            .tabViewStyle(.automatic)
            .toolbar(.hidden, for: .tabBar)
            .tint(Theme.accent)

            // Custom tab bar
            CustomTabBar(selectedTab: $selectedTab)
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
    }

    private var showOnboarding: Binding<Bool> {
        Binding(
            get: { leagueStore.hasAttemptedLoad && !leagueStore.hasLeagues },
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
        .padding(.bottom, 24)
        .background(
            Theme.darkSurface
                .clipShape(.rect(topLeadingRadius: 20, topTrailingRadius: 20))
                .shadow(color: .black.opacity(0.15), radius: 16, y: -6)
        )
    }
}

