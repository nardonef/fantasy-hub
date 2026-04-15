import SwiftUI
import ClerkKit

@main
struct FantasyHubApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var leagueStore = LeagueStore()

    init() {
        Clerk.configure(publishableKey: "pk_test_Z29vZC1naXJhZmZlLTQ5LmNsZXJrLmFjY291bnRzLmRldiQ")
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if !authManager.isReady {
                    // Splash while Clerk restores session
                    ZStack {
                        Theme.background.ignoresSafeArea()
                        VStack(spacing: Theme.spacingMD) {
                            Image(systemName: "trophy.fill")
                                .font(.system(size: 48))
                                .foregroundStyle(Theme.accent)
                            ProgressView()
                                .tint(Theme.accent)
                        }
                    }
                } else if authManager.isAuthenticated {
                    MainTabView()
                        .environmentObject(authManager)
                        .environmentObject(leagueStore)
                } else {
                    SignInView()
                        .environmentObject(authManager)
                }
            }
            .environment(Clerk.shared)
            .alert("Session Expired", isPresented: $authManager.sessionExpired) {
                Button("Sign In") {
                    authManager.acknowledgeSessionExpiry()
                }
            } message: {
                Text("Your session has expired. Please sign in again to continue.")
            }
        }
    }

}
