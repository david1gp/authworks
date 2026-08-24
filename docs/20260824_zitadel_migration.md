# ZITADEL migration utility

This utility exports ZITADEL users, organizations, organization memberships and mapped roles, projects, project roles,
and project grants through the ZITADEL Admin/Management HTTP APIs. It imports the resulting JSON snapshot through the
Authworks storage repositories in one transaction. It does not access or modify the ZITADEL database.

## Required environment

Export requires:

- `ZITADEL_API_URL` — the ZITADEL HTTPS base URL, without a path.
- `ZITADEL_SERVICE_ACCOUNT_TOKEN` — a service-account bearer token with instance-wide read access. The utility never
  prints this value.
- `AUTHWORKS_MIGRATION_SNAPSHOT_PATH` — output path for the JSON snapshot.

Import requires:

- `AUTHWORKS_DATABASE_PATH` — the file-backed Authworks SQLite database path.
- `AUTHWORKS_REALM_ID` — the existing Authworks target realm ID.
- `AUTHWORKS_MIGRATION_SNAPSHOT_PATH` — the snapshot produced by export.

Optional: `ZITADEL_SEARCH_PAGE_SIZE` controls API page size and defaults to `100` (maximum `1000`). The corresponding
CLI flags override these environment values: `--api-url`, `--token`, `--output`, `--page-size`, `--database`, `--realm-id`,
and `--input`.

## Commands

Run from the Authworks repository. Keep the database stopped or otherwise exclusively writable during import.

```bash
export ZITADEL_API_URL="https://auth.example.invalid"
read -r -s ZITADEL_SERVICE_ACCOUNT_TOKEN
export ZITADEL_SERVICE_ACCOUNT_TOKEN
export AUTHWORKS_MIGRATION_SNAPSHOT_PATH="./zitadel-authworks.snapshot.json"

bun run src/outputs/cli.ts zitadel-migration export

export AUTHWORKS_DATABASE_PATH="./data/authworks.sqlite"
export AUTHWORKS_REALM_ID="<existing-authworks-realm-id>"
bun run src/outputs/cli.ts zitadel-migration import
```

The commands write one JSON report to stdout. It contains per-entity `seen`, `exported`/`imported`, `created`,
`updated`, `unchanged`, and `skipped` counts plus `skipped` and `unsupported` record arrays. The export snapshot is
written with mode `0600` and contains no password material, password hashes, OIDC applications, or federated identity
links. Password and federated records are reported as unsupported. Re-running import converges by stable source IDs and
relationship keys; conflicting existing natural keys are reported as skipped rather than merged.

The exporter uses supported HTTP endpoints only: `/admin/v1/orgs/_search`, organization-scoped Management searches for
`/users/_search`, `/orgs/me/members/_search`, `/projects/_search`, `/projects/{id}/roles/_search`, and
`/projectgrants/_search`. It paginates and deduplicates records while applying `x-zitadel-orgid`; no credentials or API
response bodies are logged.
