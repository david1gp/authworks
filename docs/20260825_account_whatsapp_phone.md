# Account WhatsApp phone

## Goal

Let a signed-in user add or change the phone number shown on `/account/profile`, and activate it only after successful WhatsApp OTP verification.

## Decisions

- Keep phone management on the existing account profile page; add no route or navigation item.
- Treat the phone as a verified login identifier, not an ordinary editable profile field.
- Keep the current verified phone active until the replacement OTP succeeds.
- Require an authenticated same-realm user and bind every challenge to that user and candidate E.164 number.
- Use a dedicated account phone-change OTP purpose; do not reuse sign-in or registration verification semantics and do not issue a new session.
- Enforce existing WhatsApp availability, delivery, expiry, cooldown, attempt, replay, and rate-limit rules.
- Make verification and the realm-scoped verified-phone uniqueness change atomic, with a redacted user event.
- Reuse the current-user response's existing phone fields and the production account UI's current form/status patterns.

## Approach

- Add feature-owned phone-change contracts, challenge persistence, and user-domain mutation/event support.
- Implement start, resend, and verify actions around the existing WhatsApp delivery and security primitives.
- Expose authenticated self-service routes and typed browser client methods.
- Add the profile-page phone status, E.164 input, OTP input, resend, change, success, and error states.
- Cover the domain, transport/client, and production account flow, then run the repository check.

## Tasks

- [x] 1. Add phone-change public contracts, challenge persistence, and the atomic verified-phone mutation/event.
- [x] 2. Implement authenticated-user-bound WhatsApp phone-change start, resend, and verify actions.
- [x] 3. Add authenticated self-service routes and typed API client methods.
- [x] 4. Add account profile phone management UI, adapter state, copy, and demo behavior.
- [x] 5. Add production account end-to-end coverage and complete repository verification.

## Paths

- `src/features/users/`
- `src/features/whatsappOtp/`
- `src/features/account/ui/`
- `src/ui/i18n/model/englishCatalog.ts`
- `test/features/`
- `test/ui/`
- `e2e/accountProfilePages.spec.ts`
