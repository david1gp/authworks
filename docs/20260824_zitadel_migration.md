# ZITADEL migration

## Goal

Provide one ZITADEL-to-Authworks synchronization function through the package library and CLI. It imports all safely
portable configuration supported by Authworks, overwrites source-owned destination state, deletes source-owned records
missing from a complete source snapshot, preserves unrelated Authworks data, and converges idempotently.

## Decisions

- ZITADEL is authoritative for records owned by an import source; newer Authworks values do not win.
- Authoritative deletion applies only to records previously associated with the same realm, source instance, entity
  type, and source ID. Native Authworks records and records from another source are never deleted.
- Destructive reconciliation requires a complete snapshot and an explicit CLI opt-in. Partial exports never delete.
- Library imports and runs are non-authoritative by default. Authoritative CLI imports and runs require explicit
  confirmation unless dry-running; confirmation without authoritative mode is rejected. Incomplete collections are
  reported prominently and never delete records.
- Import safely portable organizations, human users, memberships, projects, roles, grants, project applications, OIDC
  clients, machine users, domains, equivalent login policies, supported identity providers, and stable external identity
  links.
- Do not import sessions, tokens, authorization codes, consents, signing keys, MFA secrets, passkeys, recovery codes,
  provider refresh tokens, or settings without equivalent Authworks semantics.
- Port password, OIDC client, and machine credentials only when ZITADEL exposes plaintext or a verifier Authworks can
  validate compatibly. Otherwise omit them and support explicit credential rotation with one-time secure output.
- Stable ZITADEL IDs are source identities, not Authworks persistence IDs. Migration-owned source metadata controls
  idempotency, overwrite, and deletion.
- When typed v2 organizations, projects, or grants omit source timestamps, their snapshot timestamps are deterministic
  synthetic source metadata derived from a canonical hash of non-secret source fields. Synthetic metadata is an
  idempotency/version value, not chronology; snapshot schemas remain unchanged.
- Imported identity providers are enabled only when the source explicitly reports `enabled: true` and a matching,
  valid credential bundle is supplied. Explicitly inactive providers and providers without a bundle are disabled and
  require reconfiguration. Policy-reference fallback stubs are marked active in the snapshot because they are
  actively referenced, but still remain disabled until destination credentials are provided.
- Network export happens before the database transaction. A validated snapshot is imported and reconciled atomically.
- Existing repository libraries and feature repositories are used; no ZITADEL SDK is added unless the existing HTTP
  approach cannot access a required supported endpoint.
- Use the typed library exports from `@adaptive-ds/zitadel-cli` for ZITADEL v2 organizations, users, projects, roles,
  grants, applications, domains, and user identity links. Keep a small legacy adapter only for machine users,
  memberships, login policies, and provider administration that the typed package does not yet expose.
- Production source is `https://auth.contentoren.de`; Authworks production is `https://authworks.contentoren.de`. There
  is no staging deployment, so verification uses temporary local SQLite first and production only after backup and
  exclusive database access.

## Approach

- Extend the versioned snapshot with source-instance identity, per-entity completeness, portable entities, source
  timestamps, and explicit unsupported records. Reject secret material from ordinary snapshots and reports.
- Add a migration-owned source-record table keyed by realm, normalized source instance, entity type, and source ID,
  pointing to the destination ID and last imported source version/time.
- Expand the paginated ZITADEL HTTP client and exporter. Distinguish a complete empty collection from permission,
  endpoint, or partial-export failures.
- Import parents before dependents, overwrite all mapped source-owned fields, then reconcile absent source-owned rows in
  dependency-safe order. Conflicts never transfer ownership of native rows.
- Map each ZITADEL OIDC application to an Authworks project application and OIDC client. Preserve only protocol settings
  with exact Authworks equivalents and validate redirect URIs with existing OIDC rules.
- Expose a library orchestrator that exports and imports in one call while retaining separate snapshot export/import
  functions. Add equivalent CLI `run`, `--dry-run`, authoritative reconciliation, and secure credential-output options.
- Keep reports free of credentials and include created, updated, unchanged, deleted, rotated, conflicted, skipped,
  unsupported, and incomplete counts.

## CLI usage and limitations

`zitadel-migration import` and `zitadel-migration run` accept
`--provider-credentials <path>`, or `AUTHWORKS_MIGRATION_PROVIDER_CREDENTIALS_PATH` when the flag is omitted. The
file must be regular, owner-private (no group or other permissions), at most 1 MiB, and contain strict JSON matching
the public provider credential bundle schema. The bundle is validated before import and kept in memory; its path and
contents are never included in errors or output. `--credential-output` retains its existing generated-credential
behavior.

## Tasks

- [x] 1. Add source-record persistence and storage composition with realm/source/entity uniqueness and isolation tests.
- [x] 2. Version and expand snapshot schemas with source identity, completeness, portable entity contracts, and
      secret-rejection tests.
- [x] 3. Expand the ZITADEL API client/exporter for applications, machine users, domains, policies, identity providers,
      and identity links, including pagination and completeness reporting.
- [x] 4. Convert users and organizations to source-owned authoritative upserts while preserving native records.
- [x] 5. Reconcile memberships, projects, project roles, and project grants, including source-owned deletion.
- [x] 6. Import project applications and OIDC clients, with compatible credential porting or explicit rotation.
- [x] 7. Import machine users, with compatible credential porting or explicit rotation.
- [x] 8. Import domains and equivalent organization login policies.
- [x] 9. Import supported external identity providers and stable user identity links without provider secrets.
- [x] 10. Add dependency-ordered authoritative deletion planning, dry-run output, and atomic reconciliation.
- [x] 11. Add the public library surface and one-call orchestration function.
- [x] 12. Add CLI `run`, destructive opt-in, dry-run, secure rotated-credential output, and redacted reporting.
- [x] 13. Add full convergence, overwrite, deletion, native-data preservation, source isolation, rollback, and output
      conformance coverage.
- [x] 14. Replace inferred ZITADEL wire mappings with `@adaptive-ds/zitadel-cli`; verify a protected live read export,
      dry-run, first import, idempotent rerun, provider credential handoff, secret isolation, and SQLite integrity against
      a temporary local database.
- [ ] 15. Resolve the remaining incomplete ZITADEL provider/application records, then back up and synchronize the stopped
      production Authworks database authoritatively.
