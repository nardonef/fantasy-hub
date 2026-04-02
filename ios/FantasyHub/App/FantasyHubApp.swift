import SwiftUI
import ClerkKit

@main
struct FantasyHubApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var leagueStore = LeagueStore()
    @State private var pendingInviteCode: String?

    init() {
        Clerk.configure(publishableKey: "YOUR_CLERK_PUBLISHABLE_KEY")
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
            .onOpenURL { url in
                handleDeepLink(url)
            }
            .sheet(item: $pendingInviteCode) { code in
                InviteView(inviteCode: code)
                    .environmentObject(leagueStore)
            }
            .alert("Session Expired", isPresented: $authManager.sessionExpired) {
                Button("Sign In") {
                    authManager.acknowledgeSessionExpiry()
                }
            } message: {
                Text("Your session has expired. Please sign in again to continue.")
            }
        }
    }

    private func handleDeepLink(_ url: URL) {
        // Handle fantasyhub://invite/{code}
        guard url.scheme == "fantasyhub",
              url.host == "invite",
              let code = url.pathComponents.dropFirst().first else {
            return
        }
        pendingInviteCode = code
    }
}

// Allow String to be used with sheet(item:)
extension String: @retroactive Identifiable {
    public var id: String { self }
}
