# Production account regression

## Goal

Create deterministic, replayable production account tests using dedicated `AUTHWORKS_SSOTEST_USERNAME` and `AUTHWORKS_SSOTEST_PASSWORD` credentials, reproduce the authenticated invalid-response failure, fix its actual cause, and verify every account tab in production.

## Decisions

- Store generated credentials only in the gitignored local `.env`; never commit secret values.
- Repository tests load the named environment variables and fail clearly when an explicitly requested production test lacks them.
- Use the repository-managed production test-user provisioning path and production deployment path.
- Keep tests deterministic, replayable, and committed beside the existing E2E coverage; do not use temporary scratch scripts.
- Emit privacy-safe browser diagnostics for API contract failures, including operation, URL path, status, request ID, and schema issues; never log response bodies, credentials, tokens, or personal data.
- Run tests only after each implementation increment, repair every failure, and run E2E only after its implementation is complete.

## Approach

- Provision or converge a dedicated verified production test user and persist its credentials locally.
- Add a reusable production-authenticated E2E fixture and account-tab regression coverage.
- Capture the real authenticated `/me` response and fix the precise contract or runtime defect.
- Add correlated browser/server diagnostics for future invalid-response failures.
- Release, deploy, and rerun the committed production regression.

## Tasks

- [x] 1. Provision credentials and add deterministic production authentication fixture.
- [x] 2. Add replayable authenticated account/tab regression and reproduce the defect.
- [x] 3. Fix the diagnosed production invalid response and add focused lower-level coverage.
- [x] 4. Add privacy-safe correlated browser diagnostics for invalid API responses.
- [x] 5. Verify checks and production E2E, commit, release, deploy, and verify production.

## Paths

- `.env`
- `.env.example`
- `e2e/`
- `src/features/account/`
- `src/features/users/`
- `src/platform/http/`
- `test/ui/`
