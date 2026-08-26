# WhatsApp primary login

## Goal

Let users choose WhatsApp on the production login page, enter a verified phone number, complete the OTP challenge, and continue into the existing authenticated or MFA flow.

## Decisions

- Reuse the existing WhatsApp OTP availability, start, resend, and verify backend contracts without changing authentication semantics.
- Show the method only when the resolved realm and organization policy permits it and production WAHA availability is healthy.
- Accept canonical E.164 phone numbers and preserve the backend's non-disclosing identifier errors.
- Reuse existing login completion, interaction continuation, MFA, rate-limit, and inline error patterns.
- Keep demo login deterministic and network-free.
- Deploy the full current `main` history plus one focused feature commit through repository-managed `prodctl` tooling.
- Verify production UI and availability after deployment; an actual delivered-code sign-in additionally requires access to a registered recipient phone and its OTP.
- Keep live verification reproducible and explicitly gated; all WAHA access must use the typed `@adaptive-ds/waha-client` package surface.
- Add typed live-message observation to `waha-client` rather than embedding raw WAHA REST or WebSocket calls in Authworks tests.
- Supply production origins, credentials, sessions, and recipient data only through environment variables and never print sensitive values.
- Restrict each production WAHA delivery endpoint to an explicit sender-session allowlist when configured, so recipient sessions cannot be selected as OTP senders.

## Approach

- Extend login discovery, primary-method selection, screen routing, and state for WhatsApp start/code/resend/verify.
- Wire the production adapter to the existing typed WhatsApp API client and add deterministic demo behavior.
- Add the chooser and OTP panels with localized copy using existing login components and styles.
- Cover model, adapter, UI, and browser flows, then run the full repository check.
- Review, commit, push, deploy through `prodctl`, and verify the deployed login flow and service health.
- Extend `waha-client` with typed WebSocket message observation, then add a repository-managed live integration test that creates, verifies, signs in, and cleans up a test user through supported APIs.
- Filter WAHA health candidates by the endpoint's configured sender sessions before availability and delivery selection.

## Tasks

- [x] 1. Add WhatsApp primary-method discovery, screen routing, and login state transitions with focused tests.
- [x] 2. Wire production and demo adapters to WhatsApp availability, start, resend, verify, and authentication outcomes.
- [x] 3. Add the WhatsApp chooser and phone/code panels with localized copy and demo scenarios.
- [x] 4. Add production and demo end-to-end browser coverage and run the full repository check.
- [x] 5. Review, commit, push, and deploy the feature.
- [x] 6. Add and verify typed WAHA WebSocket message observation in `waha-client`.
- [x] 7. Add an explicit environment-gated Authworks live integration test using only published package surfaces, deriving the authorized recipient from its WAHA session.
- [ ] 8. Add a WAHA sender-session allowlist with focused configuration and health-candidate tests.
- [ ] 9. Deploy a `david-de`-only sender configuration, run the reproducible test with authorized `Mia` as recipient, verify authenticated or MFA continuation, and clean up the test account.

## Paths

- `src/features/login/model/`
- `src/features/login/ui/`
- `src/features/waha/`
- `src/features/demo/`
- `src/ui/production/productionRouteContractMap.ts`
- `src/ui/i18n/model/englishCatalog.ts`
- `public/i18n/`
- `test/ui/`
- `e2e/loginProduction.spec.ts`
- `e2e/loginDemo.spec.ts`
- `test/integration/whatsappOtpLive.test.ts`
- `package.json`
- `bun.lock`
- `ops/public-smoke.sh`
- `ops/prod/`
- `../waha-client/src/`
- `../waha-client/test/`
