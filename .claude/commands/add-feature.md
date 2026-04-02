Plan and implement a new feature: $ARGUMENTS

Steps:
1. Read `docs/progress.md` and `CLAUDE.md` for current state and conventions
2. Read `docs/features/analytics-spec.md` if the feature is analytics-related
3. Check if this feature already exists partially — read relevant existing files
4. Plan the implementation:
   - What API endpoints are needed? (check `api/src/routes/analytics.ts`)
   - What Swift models are needed? (check `ios/FantasyHub/Models/LeagueModels.swift`)
   - What APIClient methods are needed? (check `ios/FantasyHub/Services/APIClient.swift`)
   - What views need to be created or modified?
5. Implement in order: API endpoint → Swift models → APIClient method → SwiftUI view
6. Run `xcodegen generate` and build to verify
7. Update `docs/progress.md` to reflect what was completed
