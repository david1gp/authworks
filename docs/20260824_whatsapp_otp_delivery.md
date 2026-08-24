# WhatsApp OTP delivery

## Goal

Integrate `../waha-client` so Authworks can use WhatsApp for passwordless login OTP delivery and as a registration verification method instead of email confirmation. Offer and accept WhatsApp only while at least one configured WAHA server has a fresh, healthy `WORKING` session, and select a healthy session randomly without checking WAHA on every request.

## Decisions

- This plan is subordinate to `docs/20260817_authworks.md` and extends its users, passwords, sessions, and OTP work without moving feature behavior into platform or output composition.
- Follow the alpha reset-only rule: the current user and login-policy schema is constructed from empty and reset as a whole, without `ALTER`/backfill paths or legacy login compatibility.
- Add `@adaptive-ds/waha-client` from `../waha-client` as a package dependency and consume only its exported ESM API.
- A WAHA delivery candidate is a configured server whose `serverHealth` result has `status: "ok"` plus a session returned by `sessionList` with `status: "WORKING"`.
- Keep WAHA URLs and API keys in server-only configuration. Persist candidate identity, session name, health state, check timestamps, expiry, and failures, but never persist API keys.
- Refresh the persisted registry at startup and on a background interval. Requests use only cached healthy candidates whose check has not expired, so registration and login do not perform synchronous health scans.
- Select uniformly from fresh healthy candidates with injected randomness. Mark a candidate unhealthy immediately after a send failure and retry another randomly selected candidate at most once.
- Expose a public WhatsApp-OTP availability result. Both discovery and mutation routes enforce the same `configured + policy-enabled + fresh healthy candidate` predicate.
- Store phone numbers in canonical E.164 form. Convert a number to a WAHA chat ID by removing the leading `+` and appending `@c.us`.
- Add `phoneNumber`, `phoneNumberVerifiedAt`, `registrationVerifiedAt`, and `registrationVerificationMethod` to users. A number is trusted as a login identifier only when `phoneNumberVerifiedAt` is set.
- Password registration continues to require the existing email identity, but accepts `verificationMethod: "email" | "whatsapp"`. WhatsApp registration also requires a phone number, verifies control of it by OTP, activates the account, and does not mark the email as verified.
- Replace the password-login dependency on `emailVerifiedAt` with the channel-neutral registration verification state. Existing email confirmation sets both email and registration verification; WhatsApp confirmation sets phone and registration verification.
- Implement WhatsApp login OTP as its own feature slice rather than overloading email OTP contracts. Start requests use a verified E.164 number and remain enumeration-resistant; challenges store only hashes and retain existing cooldown, expiry, attempt, replay, tenant, MFA, and session rules.
- Apply the existing `zitadel-login` abuse-control model explicitly: a 60-second per-phone-and-purpose OTP delivery cooldown, five requests per 60 seconds for registration/start/resend/verify scopes, and five code attempts per challenge. Scope request limits independently by HMAC-derived identifier or challenge plus trusted client IP so raw phone numbers and emails are never rate-limit keys.
- Persist and update rate-limit windows atomically in SQLite so concurrent requests cannot bypass them. Identity-based throttling remains enumeration-resistant; request-level throttling returns HTTP `429`, error code `rate_limited`, and `Retry-After`.
- External WAHA calls occur only after challenge/event persistence commits. Delivery failure never exposes the OTP or rolls back committed challenge state.

## Approach

- Add a feature-owned WAHA adapter and cached health registry around `wahaClientConfig`, `serverHealth`, `sessionList`, and `messageTextSend`.
- Add a typed persisted row per configured server/session candidate with `unknown`, `healthy`, or `unhealthy` status, `checkedAt`, `expiresAt`, failure metadata, and optimistic versioning.
- Add an application lifecycle owned by composition to run an immediate refresh, periodically refresh candidates, prevent overlapping scans, and stop timers cleanly. Old persisted rows remain usable only until their freshness expiry.
- Add a selector that reads fresh healthy candidates from SQLite, uses injected random bytes for deterministic uniform selection, and resolves the selected row back to server-only credentials.
- Add WhatsApp delivery and health ports so domain/action tests do not need WAHA or network access.
- Add a shared atomic rate-limit storage primitive while keeping registration and WhatsApp OTP scopes/policies feature-owned. Resolve the client IP through an explicit trusted-proxy policy rather than trusting arbitrary forwarded headers.
- Extend users and password registration with channel-neutral registration verification while preserving all existing email registration contracts and behavior by default.
- Add WhatsApp registration challenge start/delivery/verify behavior to the password registration flow and a separate WhatsApp OTP feature for passwordless sign-in by verified phone number.
- Add a small availability route/client method returning only whether WhatsApp OTP is currently available; do not expose endpoints, sessions, status details, or credentials.
- Cover the adapter with mocked fetch, cover registry/selection with deterministic time and randomness, and cover registration/login with real temporary SQLite databases and fake delivery ports.

## Tasks

- [x] 1. Add the local `@adaptive-ds/waha-client` dependency and server-only multi-endpoint WAHA configuration parsing, including stable non-secret instance IDs, refresh interval, and freshness TTL.
- [x] 2. Add the WAHA feature ports, persisted health-candidate schema/repository, schema composition, and typed errors.
- [x] 3. Implement health refresh using `serverHealth` and `sessionList`, startup/periodic lifecycle management, stale-row expiry, overlap prevention, and immediate unhealthy marking after send failures.
- [x] 4. Implement deterministic random selection from fresh healthy candidates and WhatsApp text delivery through the explicitly selected session, including E.164-to-`@c.us` conversion and one-candidate fallback.
- [x] 5. Extend user persistence, repositories, public views, events, and actions with normalized phone and channel-neutral registration verification state, including realm-scoped uniqueness for verified phone numbers.
- [x] 6. Extend password registration schemas/actions/routes/client/CLI to select email or WhatsApp verification, create hashed WhatsApp registration challenges, enforce atomic identifier/IP registration and delivery limits, deliver after commit, verify the number, and activate the account without marking email verified.
- [x] 7. Update password login eligibility to require complete channel-neutral registration verification while preserving default email registration and verification behavior.
- [x] 8. Add the `whatsappOtp` feature slice for start, resend, and verify, mirroring email OTP security/session/MFA behavior while resolving users only by verified realm-scoped phone number and enforcing the defined cooldown, request windows, and attempt limit.
- [x] 9. Add WhatsApp OTP availability discovery and enforce the identical availability predicate in registration, OTP start, server composition, public schemas, API clients, and CLI surfaces.
- [x] 10. Add unit, persistence, route, API-client, CLI, composition, stale-health, random-selection, retry, enumeration-resistance, replay, tenant-isolation, and secret/non-disclosure tests. Cover concurrent registration/start/resend/verify limits, identifier/IP scope isolation, cooldowns, five-attempt exhaustion, and `429`/`Retry-After`; keep live WAHA tests separately gated.
- [x] 11. Document WAHA endpoint configuration, health-cache semantics, registration selection, phone requirements, operational failure behavior, and run `bun run check` with test concurrency limited to one.

## Paths

- `package.json`
- `bun.lock`
- `src/features/waha/`
- `src/features/whatsappOtp/`
- `src/features/users/`
- `src/features/passwords/`
- `src/features/emailOtp/`
- `src/features/organizations/`
- `src/platform/storage/storageSchema.ts`
- `src/platform/storage/storageSchemaCreate.ts`
- `src/platform/rateLimit/`
- `src/compositions/serverApplicationCreate.ts`
- `src/outputs/server.ts`
- `src/outputs/library.ts`
- `src/outputs/cli.ts`
- `test/features/`
- `test/conformance/`
- `test/integration/`
- `README.md`
- `docs/20260817_authworks.md`
