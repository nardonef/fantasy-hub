# Dev Mode

Dev mode bypasses Clerk authentication end-to-end so the app and API work without real credentials.

---

## How it activates

**API** — auto-detects a placeholder Clerk key:

```ts
// api/src/middleware/auth.ts
const DEV_MODE = process.env.NODE_ENV === "development"
  && process.env.CLERK_SECRET_KEY?.includes("PLACEHOLDER");
```

Set in `api/.env`:
```
CLERK_SECRET_KEY="sk_PLACEHOLDER_dev_bypass"
```

**iOS** — reads an env var injected at launch time:

```swift
// AuthManager.swift
#if targetEnvironment(simulator)
if ProcessInfo.processInfo.environment["SIMULATOR_DEV_AUTH"] == "1" {
    self?.isAuthenticated = true
    self?.isReady = true
    self?.displayName = "Dev User"
    return
}
#endif
```

The env var is passed via the `SIMCTL_CHILD_` prefix, which the simulator strips and forwards to the app process:

```bash
SIMCTL_CHILD_SIMULATOR_DEV_AUTH=1 xcrun simctl launch booted com.fantasyhub.app
```

---

## What changes

### API

| Normal | Dev mode |
|--------|----------|
| `clerkMiddleware()` applied globally | Skipped entirely |
| `requireAuth` verifies Clerk JWT | Auto-creates/reuses a `dev_user` row in `users` table |
| `req.dbUser` = real Clerk user | `req.dbUser` = `{ clerkId: "dev_user", email: "dev@fantasyhub.local" }` |

All other middleware (`requireLeagueMember`, route handlers) runs normally. The dev user must have real `league_members` rows to pass membership checks.

### iOS

| Normal | Dev mode |
|--------|----------|
| Waits 800ms for Clerk to restore session | Skips Clerk entirely |
| `authManager.userId` = Clerk user ID | `authManager.userId` = `nil` |
| `getToken()` returns a JWT | `getToken()` returns `nil` (no Clerk session) |
| API requests include `Authorization: Bearer <jwt>` | API requests sent with no auth header |

No auth header is fine because the API's `requireAuth` middleware ignores headers in dev mode.

---

## Dev user setup

The `dev_user` DB record is auto-created on first API request. To give it league access:

```sql
INSERT INTO league_members (id, user_id, league_id, role, joined_at)
VALUES (gen_random_uuid(), '<dev_user_db_id>', '<league_id>', 'OWNER', now());
```

Find the dev user's internal DB id:
```sql
SELECT id FROM users WHERE clerk_id = 'dev_user';
```

---

## Restoring real auth

Change `CLERK_SECRET_KEY` in `api/.env` back to the real key:
```
CLERK_SECRET_KEY="sk_test_..."
```

The iOS simulator bypass is compile-time guarded (`#if targetEnvironment(simulator)`) and only fires when `SIMULATOR_DEV_AUTH=1` is explicitly passed — it never activates in production builds.
