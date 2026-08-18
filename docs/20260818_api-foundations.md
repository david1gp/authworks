# API foundations

## Goal

Make the independent identity API safe to adopt and evolve by completing the selected P0 and P1 work, plus resource metadata, device authorization, and Login V2-style provisioning, without implementing ZITADEL wire compatibility or its full settings hierarchy.

## Decisions

- Keep the product an independent Hono/Valibot HTTP API; do not add ZITADEL protobuf, ConnectRPC, v1/v2beta compatibility, assets, instance APIs, or the full ZITADEL settings hierarchy.
- Use the standard `ResultError` contract as the canonical internal failure shape. `@adaptive-ds/result` already types `code` as optional, but the local wrapper and dependency schema do not currently make it canonical; align them so coded failures carry a stable `code`, the existing subject-first `op` function name, safe `errorMessage`, and optional explicitly safe structured details.
- Error codes use `{feature}.{slug}`. The feature owns its code namespace; messages never determine codes or HTTP status.
- Keep OAuth/OIDC protocol errors compliant with their standards while mapping their internal causes from `ResultError`.
- Use per-process in-memory fixed-window rate limiting for the current single-process deployment. One bounded store is composed at the server root, uses the injected runtime clock, and exposes one atomic consume operation. Restarts reset limits; Bun workers, multiple processes, containers, or replicas require gateway or shared-store enforcement.
- Introduce bounded cursor pagination before extending list data. Cursor ordering must be deterministic and resource filters must be validated public contracts.
- Standardize PATCH semantics: omitted preserves, `null` clears only where the schema explicitly allows it, arrays declare replacement behavior, and empty patches fail with a stable code.
- Use resource versions for optimistic concurrency and idempotency keys for retryable creates and other externally retried mutations.
- Add forward-only SQLite schema migrations before preserving external data. The current schema becomes baseline migration `v1`; startup schema creation is replaced by an authoritative recorded version and transactional SQLite migration locking. Version persisted event payloads separately from aggregate versions and upcast old payloads at validated read boundaries.
- Consolidate duplicate system/tenant user handlers around one resource behavior with caller authorization context while retaining both existing route families as compatibility entry points; do not add more route aliases.
- Bind selected organization context to sessions and OIDC claims with explicit switching and tenant-isolation checks.
- Resource metadata is realm-scoped and implemented as a shared `resourceMetadata` feature with string key/value entries. Users and organizations retain target lifecycle, authorization, event, and deletion ownership. Metadata supports atomic set/delete/list plus optional bounded inclusion and exact indexed filtering in user and organization lists without N+1 queries; values never enter events or errors.
- Device authorization follows RFC 8628 with separate persisted device state, keyed hashes of device and user codes, stored polling state, explicit client eligibility, authenticated CSRF-protected approval/denial, and one-time redemption. Login provisioning explicitly and idempotently creates or validates separate managed browser-login and native-device public clients; it is never a startup side effect.
- Narrow package exports to explicit public, client, server, and CLI surfaces before treating the package API as stable.

## Approach

- Stabilize shared failure, HTTP, startup, rate-limit, migration, pagination, mutation, and export contracts first.
- Migrate feature behavior incrementally, one feature or protocol boundary at a time, preserving tenant isolation and secret handling.
- Add metadata only after pagination/filter primitives exist.
- Persist selected organization context before device authorization. Add device state before its HTTP routes, then add Login V2-style provisioning so provisioning targets a complete protocol surface.
- Finish with cross-feature compatibility, deployment, migration, security, and built-output conformance.

## Tasks

- [ ] 1. Define in package documentation the compatibility boundary and stable contracts covered by tasks 2–24: independent Hono/Valibot API status and explicit non-goals; error ownership and HTTP/OAuth/OIDC mappings; origin, base-path, startup, health, and rate-limit behavior; forward-only schema migration and event-payload compatibility, explicitly superseding the prior alpha reset-only rule for these requirements only; pagination, filtering, sorting, PATCH, concurrency/ETags, and idempotency; retained system/tenant user routes; selected-organization context; resource metadata; external-identity lifecycle; machine-token semantics; RFC 8628 device authorization; explicit Login V2-style provisioning without a settings API; and the final public export allowlist. State that P2 scope is limited to tasks 17–18 and 21–23 and excludes ZITADEL protobuf, ConnectRPC, v1/v2beta wire compatibility, the full settings hierarchy, and unrelated capabilities. Task 1 changes documentation only; implementation remains in tasks 2–24.
- [ ] 2. Align the platform `ResultError` type, schema, and constructors so coded failures require the dependency's existing optional `code`, retain the existing subject-first `op` and `errorMessage`, add optional explicitly safe structured details without reinterpreting legacy `errorData`, and provide a temporary compatible path for uncoded callers until task 3 migrates them.
- [ ] 3. Replace message-substring failure classification feature by feature with owned `{feature}.{slug}` codes and explicit HTTP/OAuth/OIDC mappings; add completeness and uniqueness checks for the code catalog.
- [ ] 4. Upgrade HTTP error responses and clients to preserve stable code, operation, details, status, request ID, retryability, and relevant headers without exposing secrets or parsing localized messages.
- [ ] 5. Normalize public origin and base-path resolution, wire configured host/port into `Bun.serve`, remove import-time database side effects, and make initialization failures terminate startup explicitly.
- [ ] 6. Add liveness and readiness endpoints; readiness must reflect successful configuration, schema migration, and database access.
- [ ] 7. Add one replaceable, server-composed in-memory fixed-window rate-limit store and middleware with an atomic consume contract, bounded client/policy keys and capacity, lazy expiry cleanup, code-owned route policies, trusted-proxy-aware client address resolution, generic and OAuth-shaped 429 errors, `Retry-After`, and rate-limit headers. Use `platform.rate_limited`; fail store errors as 503; exempt only `OPTIONS` and health endpoints.
- [ ] 8. Replace startup `CREATE TABLE IF NOT EXISTS` behavior with versioned, immutable, forward-only SQLite migrations. Record the current schema as baseline `v1`, lock discovery/application with SQLite, back up existing files before mutation, apply each migration transactionally, reject unsupported versions, and test every supported upgrade path and concurrent startup.
- [ ] 9. Add a persisted event `payloadVersion` distinct from `aggregateVersion`, plus feature/event-type-owned upcasters at validated event read boundaries. Reject unknown types or versions with stable failures and prove legacy fixtures replay to current payloads.
- [ ] 10. Add shared validated cursor-pagination, filter, and sort contracts with deterministic tie-break ordering, bounded page sizes, opaque cursors, and client support.
- [ ] 11. Roll bounded pagination through every existing list action, repository, route, client, CLI command, and public response without introducing N+1 queries.
- [ ] 12. Standardize PATCH schemas and actions across features, including empty-patch rejection, explicit clearing/replacement semantics, and stable conflict/validation codes.
- [ ] 13. Add optimistic concurrency to mutable resources using expected versions/ETags and atomic `UPDATE ... WHERE version = expectedVersion` behavior in the same transaction as event append; return stable conflicts and expose fresh versions in responses.
- [ ] 14. Add durable, realm/caller/operation-scoped idempotency keys for externally retried mutations, with canonical validated-request fingerprints, atomic mutation/event/result persistence, expiry, same-request replay, changed-request conflict handling, and tenant isolation; never store raw requests or secrets.
- [ ] 15. Refactor duplicate system/tenant user route handlers to dispatch the same resource operations after resolving either system or tenant authorization context. Retain both existing route families, existing client/CLI paths, and action-layer tenant checks; add behavior-parity and permission conformance tests.
- [ ] 16. Persist selected organization context in sessions, expose explicit switching, propagate the context into OIDC claims where requested, and enforce it through authorization and project-grant paths.
- [ ] 17. After tasks 8–15, add a realm-scoped `resourceMetadata` feature with a polymorphic private table keyed by realm/resource type/resource/key and an exact-filter index. Add user/organization-owned atomic set, delete, and shared-cursor list actions with bounded string keys/values/counts, parent version updates, value-free events, isolation, no-op semantics, and metadata purge on user deletion or organization removal.
- [ ] 18. Add metadata routes, public schemas, clients, and CLI commands. Metadata is omitted from parent resources by default; optional bounded inclusion bulk-loads only the returned page and reports truncation, while paired key/value exact filters use indexed `EXISTS` queries before pagination. Remove existing user-profile and organization-authorization N+1 behavior from the final list paths.
- [ ] 19. Specify and enforce external-identity link retention, provider-disable/delete behavior, orphan reconciliation, and auditable cleanup.
- [ ] 20. Unify externally observable machine-token type, claims, authentication, rotation, revocation, and recovery semantics while preserving one-time secret return and audit safety.
- [ ] 21. After tasks 2–9, 13, and 16, add migrated OIDC-owned RFC 8628 device state and actions. Persist keyed hashes of fresh device/user codes, realm/client/scope and selected-organization binding, expiry, polling state, approval/denial, and one-time consumption; require explicit client eligibility, atomic transitions, bounded cleanup, rate limits, versioned value-safe events, and stable internal errors. Do not add routes or issue tokens in this task.
- [ ] 22. After tasks 5, 7, and 21, expose `POST /oauth2/device_authorization`, authenticated CSRF-protected browser decision routes, and only the device-code branch of `POST /oauth2/token`. Add strict form contracts, OAuth error mapping, reuse existing token issuance, typed clients, CLI polling and optional browser opening, base-path-safe URLs, discovery metadata only when complete, and RFC/security conformance; exclude token exchange and rendered UI.
- [ ] 23. After tasks 5, 14, 16, and 22, add an explicit authorized realm-scoped Login V2 provisioning action and route. Semantically idempotently create or validate separate public PKCE browser-login and device-only clients by unique provisioning keys and manifest version; reject drift, disablement, or ownership conflict without rotating secrets or widening access. Complete `prompt=none`, consent, `acr_values`, assurance-derived `acr`/`amr`, selected organization, callback-error/state, and canonical base-path behavior without a settings feature.
- [ ] 24. Remove wildcard package exports and publish only explicit root, library, server, CLI, and package metadata entry points. Audit the root/library barrel as an allowlist of supported schemas and clients, exclude persistence/routes/private domain helpers, and test both valid imports and forbidden internal subpaths.
- [ ] 25. Add final migration, error-catalog, pagination, idempotency, concurrency, rate-limit, startup, health, metadata, device-flow, Login provisioning, isolation, security, CLI, and built-output conformance; update operator and consumer documentation.

## Paths

- `README.md`
- `package.json`
- `docs/20260818_api-foundations.md`
- `src/platform/errors/`
- `src/platform/http/`
- `src/platform/configuration/`
- `src/platform/storage/`
- `src/platform/runtime/`
- `src/platform/rateLimit/`
- `src/compositions/serverApplicationCreate.ts`
- `src/outputs/server.ts`
- `src/outputs/library.ts`
- `src/outputs/library/`
- `src/features/authorization/`
- `src/features/users/`
- `src/features/organizations/`
- `src/features/sessions/`
- `src/features/oidc/`
- `src/features/externalIdentities/`
- `src/features/machineUsers/`
- `src/features/projects/`
- `src/features/resourceMetadata/`
- `test/platform/`
- `test/features/`
- `test/conformance/`
- `test/cli/`
- `test/build/`
