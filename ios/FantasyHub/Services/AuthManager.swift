import SwiftUI
import ClerkKit

/// Manages authentication state via Clerk, bridging @Observable to ObservableObject
@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var userId: String?
    @Published var displayName: String = "Fantasy Manager"
    @Published var isLoading = false
    @Published var isReady = false
    @Published var sessionExpired = false

    private var observationTask: Task<Void, Never>?
    private var sessionExpiryTask: Task<Void, Never>?

    init() {
        startObservingClerk()
        startListeningForSessionExpiry()
    }

    deinit {
        observationTask?.cancel()
        sessionExpiryTask?.cancel()
    }

    func startObservingClerk() {
        observationTask?.cancel()
        observationTask = Task { [weak self] in
            // Simulator dev bypass: skip Clerk when SIMULATOR_DEV_AUTH env var is set
            #if targetEnvironment(simulator)
            if ProcessInfo.processInfo.environment["SIMULATOR_DEV_AUTH"] == "1" {
                await MainActor.run {
                    self?.isAuthenticated = true
                    self?.isReady = true
                    self?.displayName = "Dev User"
                }
                return
            }
            #endif
            // Give Clerk a moment to restore cached session
            try? await Task.sleep(for: .milliseconds(800))
            await self?.syncState()
            await MainActor.run { self?.isReady = true }

            while !Task.isCancelled {
                await self?.syncState()
                try? await Task.sleep(for: .milliseconds(500))
            }
        }
    }

    private func syncState() {
        let clerk = Clerk.shared
        let user = clerk.user
        let wasAuthenticated = isAuthenticated

        if let user {
            isAuthenticated = true
            userId = user.id
            displayName = Self.resolveDisplayName(from: user)
        } else {
            isAuthenticated = false
            userId = nil
            displayName = "Fantasy Manager"
        }

        if wasAuthenticated != isAuthenticated {
            isLoading = false
        }
    }

    private func startListeningForSessionExpiry() {
        sessionExpiryTask = Task { [weak self] in
            for await _ in await APIClient.shared.onSessionExpired {
                guard let self, !Task.isCancelled else { break }
                if !self.sessionExpired {
                    self.sessionExpired = true
                }
            }
        }
    }

    func acknowledgeSessionExpiry() {
        sessionExpired = false
    }

    func signOut() async {
        do {
            try await Clerk.shared.auth.signOut()
            isAuthenticated = false
            userId = nil
        } catch {
            print("Sign out error: \(error)")
        }
    }

    /// Resolves a human-readable display name from a Clerk user.
    /// Priority: full name > first name > primary email > "Fantasy Manager".
    /// Never returns the raw Clerk user ID.
    private static func resolveDisplayName(from user: User) -> String {
        let first = user.firstName?.trimmingCharacters(in: .whitespaces)
        let last = user.lastName?.trimmingCharacters(in: .whitespaces)

        // Build full name from available parts
        let nameParts = [first, last].compactMap { $0 }.filter { !$0.isEmpty }
        if !nameParts.isEmpty {
            return nameParts.joined(separator: " ")
        }

        // Fall back to primary email address
        if let email = user.emailAddresses.first?.emailAddress, !email.isEmpty {
            return email
        }

        return "Fantasy Manager"
    }

    /// Get the current session token for API requests
    func getToken() async -> String? {
        do {
            return try await Clerk.shared.auth.getToken()
        } catch {
            print("Get token error: \(error)")
            return nil
        }
    }
}
