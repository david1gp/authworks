# Recent session resume

## Goal

Allow a valid recent browser session to continue the hosted login flow without another sign-in, with a 30-day default session lifetime that an organization can override.

## Decisions

- A recent session ID is never an authentication credential; resume requires the existing secure browser session cookie and server-side ownership and validity checks.
- Resume rotates the session credential, refreshes the secure cookie, and completes the existing login flow; invalid, expired, revoked, or mismatched sessions fall back to sign-in.
- The platform default lifetime remains 30 days.
- An organization may override the lifetime for sessions issued in its login context; the effective lifetime is captured when a session is issued or resumed and does not retroactively rewrite other sessions.
- Organization-specific lifetime does not broaden realm, user, assurance, or revocation boundaries.

## Approach

- Extend organization login policy persistence and public schemas with an optional bounded session lifetime and resolve it over the 30-day default.
- Apply the resolved lifetime at organization-aware session issuance and resume boundaries while retaining explicit internal expiry overrides.
- Add a browser-only resume action and route that authenticates the current cookie, verifies the selected recent session, rotates its credential, and emits the normal cookie response.
- Connect recent-account selection to resume and preserve the existing password path as the failure fallback.
- Cover policy resolution, session security, rotation, cookie behavior, and login-state behavior with focused tests, then run the repository check.

## Tasks

- [ ] 1. Add and test the organization session-lifetime policy and 30-day effective default.
- [ ] 2. Apply effective organization lifetime to session issuance with explicit expiry precedence.
- [ ] 3. Add and test secure recent-session resume and credential rotation.
- [ ] 4. Connect hosted-login recent-account selection to resume with sign-in fallback.
- [ ] 5. Run full repository verification and address only regressions caused by this feature.

## Paths

- `src/features/organizations/**`
- `src/features/sessions/**`
- `src/features/login/**`
- `test/features/organizations.test.ts`
- `test/features/organizationSettings.test.ts`
- `test/features/sessions.test.ts`
- `test/features/sessionsBrowserSecurity.test.ts`
- `test/ui/loginApi.test.ts`
- `test/ui/loginChooserState.test.ts`
- `docs/20260825_recent_session_resume.md`
