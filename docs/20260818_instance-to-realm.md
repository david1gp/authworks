# Instance-to-realm breaking rename

## Goal

Replace the tenant-domain `instance` abstraction with `realm` everywhere, without compatibility aliases or a database migration, while preserving behavior and realm isolation.

## Decisions

- Rename domain vocabulary consistently: `instance`/`instances`/`instanceId`/`instance_id`/`INSTANCE_ID` become `realm`/`realms`/`realmId`/`realm_id`/`REALM_ID`.
- Rename all domain-related directories, filenames, symbols, route segments and parameters, request/response fields, client methods, package subpaths, CLI commands/options/placeholders/help/output, persisted identifiers, event names, fixtures, tests, and documentation.
- Rename `InstanceSystemContext` and `InstanceTenantContext` to `RealmSystemContext` and `RealmTenantContext`; retain generic multi-tenancy terms such as `tenant`, `kind: "tenant"`, and `multi-tenant` where they describe the security model rather than the old resource name.
- Rename event types from `instance.*` to `realm.*`, aggregate/domain values from `instance` to `realm`, and event storage `instanceId`/`instance_id` to `realmId`/`realm_id`.
- Physically rename SQLite tables, columns, indexes, constraints, and foreign-key references. Existing databases may be reset; no migration or old-name compatibility surface is added.
- Do not alter unrelated JavaScript `instanceof` syntax or generic uses of “instance” that mean an object/runtime occurrence.
- There is no instance-specific environment variable today; CLI placeholder `INSTANCE_ID` still becomes `REALM_ID`.

## Approach

- Perform one coordinated source rename, then correct persistence, transport, CLI, documentation, and verification surfaces against the canonical vocabulary.
- Keep public transport schemas separate from Drizzle persistence schemas and preserve existing feature boundaries.
- Require a final negative audit for old domain names, allowing only reviewed generic occurrences such as `instanceof`.

## Tasks

- [x] 1. Rename the instances feature, every prefixed file and symbol, realm contexts, cross-feature imports, library output module, event names, and tests/fixtures that directly exercise the feature.
- [x] 2. Propagate `realmId` and realm context through organizations, users, passwords, sessions, email OTP, external identities, MFA, passkeys, machine users, projects, OIDC, authorization, and impersonation while preserving isolation checks.
- [x] 3. Rename all persistence tables, columns, Drizzle properties/types, indexes, constraints, foreign keys, schema-create/reset SQL, repository contracts, and event-store fields.
- [x] 4. Rename every HTTP route/parameter, public request/response field and schema, API client surface, package/library export, and distributable-output assertion.
- [x] 5. Rename CLI command trees, options, placeholders, help text, internal fields, and JSON output from instance to realm.
- [x] 6. Update the authoritative plan, README, architecture prose, test descriptions, remaining fixtures, and package metadata where the old term denotes the domain abstraction.
- [x] 7. Audit filenames and content for legacy domain terms, correct missed occurrences, verify old routes/exports are absent, and run `bun run check`.

## Paths

- `src/features/instances` → `src/features/realms`
- `src/features/{authorization,emailOtp,externalIdentities,impersonation,machineUsers,mfa,oidc,organizations,passkeys,passwords,projects,sessions,users}`
- `src/platform/storage`
- `src/outputs/{server.ts,library.ts,cli.ts,library}`
- `test`
- `README.md`
- `docs/20260817_authworks.md`
- `package.json`

## Current context

- The feature now lives under `src/features/realms`; its prefixed files, symbols, contexts, events, direct tests, library output module, and organization realm-login-policy files are realm-named.
- Internal domain, action, event, repository, persistence-property, authorization, and isolation contracts now use `realmId` across the scoped features.
- SQLite tables, columns, indexes, constraints, foreign keys, schema-create/reset SQL, and event-store fields now use realm vocabulary; no migration or compatibility schema was added.
- HTTP routes/parameters, transport fields/schemas, API clients, package/library exports, conformance tests, and distributable-output assertions now expose only realm vocabulary.
- CLI commands, options, placeholders, help, internal fields, labels, and outputs now use realm vocabulary without aliases.
- The authoritative plan, README, domain prose, remaining helper variables, and test descriptions now use realm vocabulary; package metadata required no change.
- Tasks 1–7 verification and an independent full-diff audit passed with focused feature/API/library/conformance/CLI tests, output verification, `bun run check`, builds, format checks, and `git diff --check`; the only remaining legacy terms are this plan's audit vocabulary, reviewed negative assertions, and generic JavaScript/runtime uses.
