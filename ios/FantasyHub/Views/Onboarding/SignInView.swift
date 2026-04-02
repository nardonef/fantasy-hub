import SwiftUI
import ClerkKit
import ClerkKitUI

/// Sign-in screen using Clerk's prebuilt authentication UI
struct SignInView: View {
    @EnvironmentObject private var authManager: AuthManager
    @State private var showAuth = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: Theme.spacingLG) {
                Spacer()

                // App icon / branding
                Image(systemName: "trophy.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(Theme.accent)

                VStack(spacing: Theme.spacingSM) {
                    Text("Fantasy Hub")
                        .font(Theme.displayFont)
                        .foregroundStyle(Theme.textPrimary)

                    Text("Deep analytics for your fantasy leagues")
                        .font(Theme.bodyFont)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                Button {
                    showAuth = true
                } label: {
                    Text("Sign In")
                        .font(Theme.titleFont)
                        .foregroundStyle(Theme.background)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.spacingMD)
                        .background(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
                }
                .padding(.horizontal, Theme.spacingLG)
                .padding(.bottom, Theme.spacingXL)
            }
        }
        .sheet(isPresented: $showAuth) {
            AuthView()
        }
    }
}
