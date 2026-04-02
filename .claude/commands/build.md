Build the iOS app, start all required services, install the app on the simulator, and launch it with the Simulator window visible.

## 1. Start required services

- Check if PostgreSQL is running: `pg_isready`
  - If not running: `brew services start postgresql@17`
- Check if Redis is running: `redis-cli ping`
  - If not running: `brew services start redis`

## 2. Start the API server (if not already running)

- Check if the Fantasy Hub API is running: `curl -s http://localhost:3000/api/leagues 2>&1 | head -1`
  - If the response is valid JSON (starts with `[` or contains `"error"`), the API is running
  - If connection refused or HTML response, the wrong server or nothing is on port 3000
- If not the correct API:
  - Kill whatever is on port 3000: `lsof -ti :3000 | xargs kill 2>/dev/null`
  - Ensure `api/.env` exists — if not, copy from `api/.env.example` and warn the user to fill in values
  - Ensure `api/node_modules` exists — if not, run `cd api && npm install`
  - Ensure Prisma client is generated — if `api/node_modules/.prisma/client` or `api/src/generated/prisma` doesn't exist, run `cd api && npx prisma generate`
  - Start the dev server in the background: `cd api && npm run dev` (use `run_in_background`)
  - Wait briefly and verify it started by checking the endpoint again

## 3. Build the iOS app

1. Run `xcodegen generate` from the `ios/` directory to ensure the Xcode project includes all files
2. Build with: `xcodebuild -project FantasyHub.xcodeproj -scheme FantasyHub -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1`
3. If there are errors, fix them and rebuild

## 4. Install and launch on the simulator

1. Ensure the simulator is booted: `xcrun simctl boot "iPhone 17 Pro"` (ignore "already booted" errors)
2. Open the Simulator window: `open -a Simulator`
3. Terminate the app if running: `xcrun simctl terminate booted com.fantasyhub.app` (ignore errors)
4. Install the app: `xcrun simctl install booted <path-to-built-.app>`
   - IMPORTANT: `simctl install` preserves app data (keychain, UserDefaults) when overwriting an existing install. This keeps the user's Clerk session alive across builds. Do NOT uninstall first.
5. Launch the app: `xcrun simctl launch booted com.fantasyhub.app`

## 5. Report

Report success with:
- Services status (PostgreSQL, Redis, API)
- Build result
- Simulator + app launch status

Or list any errors with file paths and line numbers.
