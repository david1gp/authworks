# Account identity experience

## Goal

Fix the reported account navigation and page issues, clarify profile fields and administration access, restore the organization list, and support multiple verified email addresses as login and account-recovery identifiers.

## Decisions

- Every verified email address can identify the user for password login, email OTP, and account recovery.
- Each user has exactly one primary email; OIDC and existing singular-email contracts use the primary address.
- New addresses require verification before they become usable. Only a verified secondary address can become primary.
- The primary address cannot be removed. Removing a verified secondary address immediately disables it for authentication and recovery.
- Nickname remains optional because it maps to the OIDC `nickname` claim; the profile explains how it differs from display name.
- Administration navigation is shown only when the active-realm user has `realm.read`; server-side route authorization remains authoritative.
- Gender uses `SelectSingle` with icons and preserves an unspecified option.

## Approach

- Generalize the users-owned email persistence and challenge flows while preserving the primary-email projection used by existing public contracts.
- Update every email-based authentication and recovery lookup to resolve verified addresses with realm isolation.
- Add account-safe email list, add/verify, promote, and remove operations, then update the account email UI.
- Apply the independent account shell/profile fixes and diagnose the production organization response against its strict contract.
- Keep feature behavior under its owning feature and production outputs as thin compositions.

## Tasks

- [x] 1. Fix active sidebar icon color and remove redundant work-area branding.
- [x] 2. Replace free-text gender with icon-based `SelectSingle` and explain nickname usage.
- [x] 3. Reproduce and fix the account organizations invalid-response path with contract coverage.
- [x] 4. Expose current-user `realm.read` capability and add conditional Account/Admin navigation links.
- [x] 5. Add multi-email persistence, primary invariants, and existing-user primary-address setup.
- [x] 6. Add address lifecycle actions, public contracts, routes, client methods, events, and tests.
- [x] 7. Resolve every verified address for password login, email OTP, and account recovery; retain primary OIDC claims.
- [x] 8. Build the account email address list/add/verify/promote/remove UI.
- [x] 9. Run focused tests, browser verification, and `bun run check`.

## Paths

- `src/features/users/`
- `src/features/passwords/`
- `src/features/emailOtp/`
- `src/features/oidc/`
- `src/features/authorization/`
- `src/features/account/ui/`
- `src/features/organizations/`
- `src/ui/production/`
- `src/ui/i18n/`
- `ui/static/icon/`
- `ui/input/select/`
- `test/features/`
- `test/ui/`
- `e2e/`
