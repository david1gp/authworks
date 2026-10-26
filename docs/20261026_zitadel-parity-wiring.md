# Zitadel parity wiring — implementation tracker

Branch: `fix/zitadel-parity-wiring` (from `main` 8966cd4). Decisions: fix all P0+P1+P2; add Zitadel-core subset; enforce project dead flags + ID-token/UserInfo role claims (roles claims-only).

Non-goals (document only): SAML, SCIM, LDAP, Actions V2, webhooks, device grant, token exchange, PAR/JAR/DPoP/mTLS/CIBA, SMS-as-2FA, per-org email templates/custom texts, private_key_jwt, implicit/hybrid grants, front/back-channel logout delivery.

## Checklist

- [x] 01 organizations tenant routes — routes already existed (verified); added tenant-route HTTP tests. Realm remove/default split (product decision needed).
- [x] 02 directory+users lists (org-less users, state/verified filters, phone search, CLI flags). Split: user-list role filter needs organizations server surface.
- [x] 03 passwords policy (maxAgeDays enforced at login, org-scoped password policy override all surfaces)
- [x] 04 passwords/OTP hardening (allowPassword on change, whatsapp upfront org enforce, emailOtp notification wired to structured log)
- [x] 05 rate-limit + OTP lockout (5/min limits, shared otp_lockouts, no double-count with password lockout)
- [x] 06 mfa core fixes (vocabulary unified+reject unknowns, explicit legacy mode enforced, step_up unified, fail-closed secret, passkey rename). Note: beside-feature tests under src/features/{users,directory,mfa,passkeys,passwords} need wiring into `bun run test` path list (item 28).
- [x] 07 mfa lifetimes (on org login policy realm+override; init-skip, check freshness, forceMfaLocalOnly, migration round-trip)
- [x] 08 admin auth-method reset backend (user.manage DELETE routes in mfa/passkeys)
- [x] 09 oidc correctness (discovery, offline_access gating, phone claims, prompt/max_age, 5s skew, RFC7617)
- [x] 10 oidc client config (per-client lifetimes, grant/response allowlists, devMode, introspection, JWKS prune+delete)
- [x] 11 oidc claims (idTokenRoleAssertion, UserInfo roles, acr/amr/auth_time everywhere, domain-less org roles, consent precedence docs)
- [x] 12 projects enforcement (flags enforced at authorize/consent, CLI flags, grantedToOrganizationId)
- [x] 13 externalIdentities (generic OIDC IdP, microsoft auto-link, linkStart policy, secret encryption at rest)
- [x] 14 events+machine security (event.read in action, filters+export, scope catalog validation, revoke wired)
- [x] 15 metadata (org + user KV across API/client/CLI/MCP, value-free events)
- [x] 16 account export endpoint + client + CLI (secret-free, self-only)
- [x] 17 parity clients/lib (sessions/impersonation/passkey clients+CLI, ./directory export, email barrel cleaned, error-code conformance)
- [x] 18 CLI parity (48 commands, user create profile flags, --clear-application-id, migration exception in AGENTS.md)
- [x] 19 MCP expansion A (33 tools, schema converter fixes, scope-gated)
- [x] 20 MCP expansion B (OIDC reads, machine credential list, session list, documented exclusions)
- [x] 21 admin shell (sessions revoke, nav, consents picker, events filters UI)
- [x] 22 admin OIDC forms (project/app selectors, new fields)
- [x] 23 admin policy/IdP forms (login-policy controls, IdP edit fields, metadata editors)
- [x] 24 admin directory/machine (suspend, purge, resend-verify, auth-method reset UI, machine edit)
- [x] 25 consent UI (production /consent + /login/consent) — P0
- [x] 26 login/account polish (change-required, register guard, MFA roster, invitations, error i18n, export button)
- [x] 27 docs/ops (README, demo contradiction, deploy path, .env.example, migration fidelity, import fix)
- [x] 28 test suites (realms/orgs isolation, OIDC conformance, production e2e)

## Gates

- [x] `bun run format` + `bun run check` green in worktree
- [x] `bun run test:e2e:dev` green in worktree
- [x] Conventional commits + push branch
- [ ] Merge to `main`, push, cleanup worktree/branch
- [ ] `bun run test:e2e:dev` on `main`
- [ ] `bun run deploy` + production smoke/e2e
