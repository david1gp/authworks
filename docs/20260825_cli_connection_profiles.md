# CLI connection profiles

## Goal

Improve the CLI experience for operators who switch between Authworks instances, identities, realms, and organizations by adding local named connection profiles without changing server authentication or feature APIs.

## Decisions

- Implement profiles as a new `connectionProfiles` feature; keep `src/outputs/cli.ts` limited to static command composition.
- Store profiles in one plaintext JSON file at `${XDG_CONFIG_HOME}/authworks/profiles.json`, falling back to `~/.config/authworks/profiles.json`.
- A profile may contain `server`, `token`, `realmId`, and `organizationId`. Partial profiles are valid. Never store or resolve `AUTHWORKS_SYSTEM_SECRET` from a profile.
- Support an implicit `default` profile. `--profile <name>` selects a named profile; if omitted, the CLI uses `default` when it exists and otherwise preserves current behavior. An explicitly selected missing profile is an error.
- Add `authworks profile set <name>`, `list`, `show <name>`, and `delete <name>`. `set` upserts supplied fields without clearing omitted fields. `show` and `list` never reveal token values.
- Validate profile names before filesystem access: 1–64 characters, beginning with an alphanumeric character and containing only letters, numbers, `.`, `_`, or `-`.
- Resolve each value independently in this order: explicit command flag, existing environment variable, selected profile, then the existing default. Retain current flag names such as `--server` and all current environment-only workflows.
- Keep the first security increment simple: owner-only profile-file permissions and secret redaction. Keyring integration, encryption, advanced filesystem hardening, credential expiry, and login/token issuance are separate future features.
- Keep profiles local to the CLI. Do not add database tables, server routes, public API schemas, package exports, cross-profile operations, or a persistent active-profile setting.

## Approach

- Build a feature-owned profile model, path resolver, JSON store, and CLI resolution surface with injectable environment/home inputs for deterministic tests.
- Compose profile management commands into the existing `@stricli/core` route map and follow current JSON output and error conventions.
- Centralize connection-value precedence, then migrate existing feature command trees incrementally while keeping each feature dependent only on the connection profile feature's explicit CLI surface.
- Exercise storage and precedence with focused tests, then cover representative command trees with real CLI subprocess tests and temporary `XDG_CONFIG_HOME` directories.
- Document profile commands, selection, precedence, storage, plaintext-token tradeoffs, and the system-secret exclusion in the README.

## Tasks

- [x] 1. Add the `connectionProfiles` domain model, name validation, config-path resolution, plaintext JSON store, owner-only file creation, and focused tests for CRUD, partial profiles, malformed files, and secret-safe failures.
- [x] 2. Add the `profile set/list/show/delete` command tree, compose it into the CLI output, and test help, upsert behavior, deterministic listing, redacted output, invalid names, and missing profiles.
- [x] 3. Add the shared CLI connection resolver and `--profile` option with field-by-field flag/environment/profile/default precedence; cover implicit default, explicit named selection, missing-profile behavior, and backward-compatible environment resolution.
- [x] 4. Integrate profile resolution into feature CLI commands, with representative subprocess tests for server, token, realm, and organization values.
  - [x] Realms, organizations, and users.
  - [x] Passwords, sessions, email OTP, and external identities.
- [x] 5. Integrate profile resolution into the remaining CLI commands; keep system-secret inputs exclusively flag/environment sourced and token values out of output and errors.
  - [x] OIDC, MFA, impersonation, and passkeys.
  - [x] Machine users, projects, WhatsApp OTP, and ZITADEL migration.
- [x] 6. Update CLI documentation and regression coverage, verify distributable CLI composition, and run `bun run check` with test concurrency limited to one.

## Paths

- Plan: `docs/20260825_cli_connection_profiles.md`
- Authoritative project plan: `docs/20260817_authworks.md`
- New feature: `src/features/connectionProfiles/**`
- Shared scope helper: `src/platform/cli/scopeIdResolve.ts`
- Existing feature integrations: `src/features/{realms,organizations,users,passwords,sessions,emailOtp,externalIdentities,oidc,mfa,impersonation,passkeys,machineUsers,projects,whatsappOtp,zitadelMigration}/cli/**`
- CLI composition: `src/outputs/cli.ts`
- CLI and feature tests: `test/cli/**`, `test/features/**`
- User documentation: `README.md`
