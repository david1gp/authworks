# Account and organization security priorities

## Goal

Complete the high-priority self-service account settings by adding user pictures, verified email changes, external-identity linking, refresh-token management, effective-access visibility, the missing gender control, and user-visible security history, together with stronger organization security policies for MFA, factor selection, and step-up assurance.

## Decisions

- Preserve the existing feature ownership and public/client/server/UI boundaries.
- Keep the scope to the listed account and organization-security capabilities; do not add username changes, SAML, SCIM, generic identity providers, SMS OTP, programmable actions, quotas, or unrelated ZITADEL parity.
- Reuse the existing user-profile, external-identity, OIDC, authorization, event, MFA, passkey, organization-policy, account, and admin surfaces rather than creating parallel subsystems.
- Model a user picture as an optional validated HTTPS asset reference with optional content type, using the existing branding-asset convention. Support set and remove through profile updates; binary upload, image hosting, and a general media service remain out of scope.
- Keep the current email active until a pending replacement is verified. A successful verification atomically installs the replacement as verified, preserves the user's completed registration state, consumes the challenge, and notifies the old address. Start, resend, verify, expiry, replay, rate-limit, uniqueness, recent-authentication, and concurrent-update behavior must be explicit.
- Expose provider linking through authenticated account `/me` surfaces over the existing start, callback, confirmation, and unlink actions. Keep recent-authentication, state, nonce, PKCE, provider-scope, duplicate-identity, and last-usable-method protections.
- List only safe refresh-token metadata. Revoking one account-visible token revokes its complete token family and associated access tokens; revoke-all affects only the authenticated user in the current realm.
- Present effective access as stable cursor-paginated flat entries containing the active organization membership and, when applicable, an active project/grant, effective role keys, resolved permissions, and access source. Derive authority from the authenticated session subject, omit stale role references and inactive or cross-realm resources, and show the impersonated subject's access rather than the impersonator's access.
- Build security history as a cursor-paginated, newest-position-first projection over append-only events. Add an events-owned, transactionally written and indexed user-subject mapping for reviewed event types; never infer the subject from actor ID alone or expose the generic realm event API. Use a positive event allowlist and purpose-built display fields that exclude event payloads, raw network identifiers, OAuth subjects, credential identifiers, secrets, and internal correlation data.
- Add organization policy controls for required MFA, allowed MFA factors, preferred factor order, and minimum step-up assurance. The configurable MFA factors are `totp`, `email_otp`, and `passkey`; WhatsApp OTP remains primary-only, and recovery codes remain an unordered emergency fallback rather than a configurable factor.
- A primary passkey alone produces authenticated assurance. A permitted factor produces multi-factor assurance only when completed after a distinct primary method in the same validated organization login interaction. Required MFA governs login completion; minimum step-up assurance governs protected organization operations.
- Resolve policy field by field from platform defaults to realm values to nullable organization overrides. Effective required MFA is the stricter realm/organization value; organization factor sets must narrow the realm set; effective ordering filters the organization order, then realm order, then canonical order against permitted and runtime-available factors; effective assurance is the stronger realm/organization value.
- Reject unknown or duplicate factors, empty effective factor sets when MFA is required, order entries outside the configured allowlist, weaker-than-realm overrides, and invalid assurance values. Required MFA with no enrolled permitted factor enters an enrollment/remediation flow rather than issuing an authenticated session or locking the user out without recourse.
- Derive organization context from the server-side login interaction, never a caller-authoritative identifier. Validate realm and organization lifecycle when the interaction starts, retain the context through primary and MFA challenges, and revalidate it at completion, session issuance, organization switching, and step-up; apply membership checks where the protected operation requires membership.
- Enforce effective policy after every supported primary method, during factor selection/completion, at session assurance issuance, and at organization-protected step-up checks. Existing behavior remains unchanged when the new fields are unset.
- Keep email-change state and events in `users`; keep rendering and delivery in `email`. Commit state and events atomically, then send verification and old-address notifications after commit through the existing best-effort delivery boundary without adding a durable outbox.
- Require all cross-feature integration through explicit public, client, server, or CLI surfaces. Add account-safe organization, project, authorization, events, MFA, and session integration contracts where current surfaces are insufficient; never aggregate account data through another feature's persistence or internal actions.
- Add CLI support for realm/organization security-policy administration. Keep browser-session `/me` operations on public library/client and account UI surfaces rather than introducing a separate CLI authentication model.
- Never expose credential material, token hashes, event internals, or cross-tenant data through account settings or security history.

## Approach

- Define the public account and policy contracts first, then implement persistence and domain behavior behind their owning features.
- Deliver each capability vertically through actions, events, routes, clients, UI, and focused security tests where those surfaces apply.
- Reuse the existing profile update route for picture and gender; add purpose-built `/me` actions for security-sensitive email, linking, token, access, and history operations.
- Inventory and accept the event-to-user subject and safe-display mapping before exposing security history, then write the subject index in the same transaction as each covered event.
- Extend the existing organizations-owned realm defaults and organization overrides instead of creating a second policy subsystem, resolve policy before authentication completion, and carry the validated organization context through challenge and session issuance boundaries.
- Integrate completed capabilities into the existing account and organization-admin navigation, add localized copy and demo fixtures, and verify representative production and demo browser flows.

## Tasks

- [x] 1. Extend the user profile contract, persistence, normalization, public view, changed-field event, route, and client with the optional picture asset; add picture set/remove and the existing gender field to production/demo account profile state and UI, with schema, tenant, CSRF, and browser tests.
- [x] 2. Add a users-owned pending email-change challenge and start/resend/verify actions, events, `/me` routes, API client, delivery templates, account UI, and tests for unchanged/conflicting addresses, expiry, replay, rate limiting, recent authentication, atomic replacement, old-address notification, and safe event data.
- [x] 3. Connect account security settings to the existing external-identity provider list and link start/callback/confirmation actions, preserving unlink safeguards and adding production/demo UI plus security tests for provider scope, state/nonce/PKCE, duplicate links, tenant ownership, recent authentication, and last usable methods.
- [x] 4. Add OIDC account contracts, repository queries, actions, `/me` routes, client methods, and account security UI to list safe refresh-token metadata and revoke one family or all current-user families; test token secrecy, family/access-token invalidation, idempotency, ownership, realm isolation, and events.
- [x] 5. Add account-safe organization, project, and authorization read surfaces, then an account-owned effective-access contract and aggregation action returning bounded cursor-paginated flat entries; add `/me` route, client, account UI grouping, and tests for active lifecycle, deduplication, stale roles, resolved permissions, impersonation subject semantics, pagination, and cross-tenant isolation.
- [x] 6. Inventory the covered security events and define each event's subject, transaction boundary, category, and safe display mapping; add an events-owned indexed user-subject mapping written atomically with covered events, strict position cursor queries, and tests proving actor/subject and realm isolation.
- [x] 7. Add the user-scoped security-history schema, projection, `/me` route, client, and account UI over the events-owned subject query; use an explicit allowlist and add projection, redaction, pagination, isolation, and browser tests covering sessions, passwords, MFA, passkeys, linked identities, email changes, refresh-token revocations, and impersonation notices.
- [x] 8. Extend organizations-owned realm defaults and organization overrides with required MFA, allowed factors, preferred order, and minimum step-up assurance; implement canonical factor contracts, validation, persistence, explicit inheritance/strength resolution, realm and organization administration routes, events, clients, CLI commands, and tests for invalid combinations, defaults, stricter realm precedence, and tenant isolation.
- [x] 9. Establish server-validated organization context across login interactions, primary and MFA challenges, switching, and step-up; reject inactive, stale, wrong-realm, and mismatched contexts and test context retention/revalidation without changing unset-policy behavior.
- [x] 10. Enforce allowed-factor selection and completion for TOTP, email OTP, and passkey MFA, keep recovery codes fallback-only, and add enrollment/remediation when required MFA has no enrolled permitted factor; test runtime availability, deterministic ordering, every primary/factor combination, and bypass resistance, including existing WhatsApp primary login.
- [x] 11. Apply effective required-MFA and assurance policy to session issuance and organization-protected operations; prove primary passkeys do not incorrectly gain multi-factor assurance, successful distinct factors do, and insufficient sessions receive step-up rather than unauthorized elevation.
- [x] 12. Add realm/organization-admin controls for inherited and overridden MFA requirement, factor allowlist/order, and minimum assurance, including validation feedback, localization, demo/production adapters, and browser coverage for inheritance, invalid states, enforcement, enrollment remediation, responsive layout, and keyboard use.
- [x] 13. Complete public subpath, client, server, and CLI output composition plus focused account/admin regression coverage.
- [ ] 14. Run `bun run check` and `bun run test:e2e`, then address only regressions caused by this plan.

## Paths

- `src/features/users/**`
- `src/features/account/**`
- `src/features/email/**`
- `src/features/realms/**`
- `src/features/externalIdentities/**`
- `src/features/oidc/**`
- `src/features/authorization/**`
- `src/features/projects/**`
- `src/features/events/**`
- `src/features/mfa/**`
- `src/features/passkeys/**`
- `src/features/passwords/**`
- `src/features/emailOtp/**`
- `src/features/whatsappOtp/**`
- `src/features/sessions/**`
- `src/features/login/**`
- `src/features/organizations/**`
- `src/features/admin/**`
- `src/features/impersonation/**`
- `src/features/demo/**`
- `src/ui/i18n/**`
- `src/platform/storage/**`
- `src/outputs/**`
- `test/**`
- `e2e/**`
- `docs/20260825_account_security_priorities.md`
