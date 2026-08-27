# External identity and authentication security tests

## Goal

Enable policy-controlled verified-email auto-linking for Google and GitHub, default it on, and close the requested authentication, verification, MFA, and OIDC security-test gaps.

## Decisions

- External identity auto-linking defaults to enabled.
- Realm policy supplies the default; an organization may explicitly enable or disable it for organization-scoped login. An unset organization value inherits the realm value.
- Organization override precedence is organization value, then realm value, then `true`.
- Automatic linking applies only to Google and GitHub in this change. Microsoft continues to require explicit linking.
- Google linking requires the provider's verified-email claim. GitHub linking requires an email returned as verified by the authoritative email endpoint. A profile email alone is insufficient.
- Auto-link only an active same-realm account with one normalized matching verified email. Never cross realms, revive deleted/inactive accounts, or replace an existing provider-subject link.
- When auto-link is disabled or ineligible, retain the explicit authenticated linking flow and do not attach an identity to the matching account.
- “Email verification replacement” means replacement of a verification challenge/code on resend, not changing the account email address.
- Enumeration tests compare public status, code, message, and response shape; they do not use brittle wall-clock assertions.
- OIDC context denial must happen before consent, code, token, or success event creation and must not redirect through an untrusted URI.

## Approach

- Extend the existing realm and organization login-policy model, effective-policy resolver, public schemas, client, and CLI with the auto-link setting.
- Resolve the effective login policy during the external identity callback and perform one transactional identity attachment when an eligible verified email matches.
- Add contract-level scenario matrices to existing feature suites, making the smallest behavior correction only where a new test exposes a gap.
- Reuse existing password challenge, MFA selection, project/grant, OIDC interaction, and event abstractions rather than creating parallel test-only paths.

## Tasks

- [x] 1. Add the default-enabled realm policy and nullable organization override for external identity auto-linking; cover persistence, effective precedence, public API, client, CLI, and package surfaces.
- [x] 2. Implement transactional Google/GitHub verified-email auto-linking and test enabled, disabled, inherited, verified, unverified, wrong-realm, inactive/deleted, existing-link, and rollback outcomes.
- [x] 3. Add login and recovery enumeration-resistance tests for existing, missing, malformed, unverified, inactive, locked, and policy-denied identities, correcting public behavior only if the matrix differs.
- [x] 4. Add password-policy boundary and forced-password-change tests across registration, change, recovery, replacement, login restriction, challenge expiry, state clearing, and session issuance.
- [x] 5. Add the email-verification challenge replacement matrix: resend invalidates the old code, wrong codes fail, only the newest code succeeds, successful codes cannot replay, and failures do not mutate verification state.
- [x] 6. Add multiple-MFA-method tests for effective preferred order, explicit permitted selection, unavailable/disallowed methods, realm/organization policy intersection, recovery fallback, and exposed challenge context.
- [x] 7. Add OIDC denial tests and any required centralized validation for valid clients used with the wrong organization, project, resource, audience, or grant context; assert denial atomicity across authorization, consent, code redemption, tokens, claims, and events.
- [x] 8. Run focused suites with test concurrency 1, then `bun run check`.

## Paths

- `src/features/externalIdentities/actions/externalIdentityCallback.ts`
- `src/features/externalIdentities/actions/externalIdentityLinkComplete.ts`
- `src/features/externalIdentities/domain/externalIdentityProviderPortCreate.ts`
- `src/features/externalIdentities/persistence/externalIdentityProviderTable.ts`
- `src/features/externalIdentities/persistence/externalIdentityTable.ts`
- `src/features/externalIdentities/public/`
- `src/features/organizations/actions/organizationLoginPolicySet.ts`
- `src/features/organizations/actions/organizationRealmLoginPolicySet.ts`
- `src/features/organizations/client/organizationApiClientCreate.ts`
- `src/features/organizations/cli/organizationCliCommands.ts`
- `src/features/organizations/domain/organizationLoginPolicyViewCreate.ts`
- `src/features/organizations/persistence/organizationLoginPolicyTable.ts`
- `src/features/organizations/persistence/realmLoginPolicyTable.ts`
- `src/features/organizations/public/organizationLoginPolicyOverrideSchema.ts`
- `src/features/organizations/public/organizationLoginPolicySetRequestSchema.ts`
- `src/features/passwords/actions/passwordLogin.ts`
- `src/features/passwords/actions/passwordRecoveryRequest.ts`
- `src/features/passwords/actions/passwordEmailVerify.ts`
- `src/features/passwords/actions/passwordChange.ts`
- `src/features/passwords/public/passwordPolicySchema.ts`
- `src/features/passwords/persistence/passwordChallengeTable.ts`
- `src/features/mfa/actions/mfaLoginChallengeStart.ts`
- `src/features/mfa/actions/mfaChallengeFactorSelect.ts`
- `src/features/mfa/actions/mfaChallengeComplete.ts`
- `src/features/oidc/actions/oidcAuthorizationRequestAuthorize.ts`
- `src/features/oidc/actions/oidcAuthorizationRequestConsent.ts`
- `src/features/oidc/server/oidcInteractionOrganizationContextValidate.ts`
- `src/features/projects/`
- `test/features/externalIdentities.test.ts`
- `test/features/externalIdentityBrowserInteraction.test.ts`
- `test/features/organizationSecurityPolicy.test.ts`
- `test/cli/organizationLoginPolicyCli.test.ts`
- `test/features/passwords.test.ts`
- `test/features/mfa.test.ts`
- `test/features/organizationSecurityPolicy.test.ts`
- `test/features/oidc.test.ts`
- `test/features/oidcBrowserInteraction.test.ts`
- `test/features/oidcResourceOwner.test.ts`
- `test/features/oidcAuthorizationEvents.test.ts`
- `test/conformance/publicImportGraph.test.ts`
- `test/build/packageSurface.test.ts`
