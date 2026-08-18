# API foundations

## Goal

Make the independent identity API safe to adopt and evolve by completing the selected P0 and P1 work, plus resource metadata, device authorization, and Login V2-style provisioning, without implementing ZITADEL wire compatibility or its full settings hierarchy.

## Decisions

- Keep the product an independent Hono/Valibot HTTP API; do not add ZITADEL protobuf, ConnectRPC, v1/v2beta compatibility, assets, instance APIs, or the full ZITADEL settings hierarchy.
- Use the standard `ResultError` contract as the canonical internal failure shape. It must carry a stable `code`, the subject-first `op` function name, a safe message, and optional structured details.
- Error codes use `{feature}.{slug}`. The feature owns its code namespace; messages never determine codes or HTTP status.
- Keep OAuth/OIDC protocol errors compliant with their standards while mapping their internal causes from `ResultError`.
- Use per-process in-memory rate limiting for the current single-process deployment. Make the storage interface replaceable and document that multiple processes or replicas require shared enforcement.
- Introduce bounded cursor pagination before extending list data. Cursor ordering must be deterministic and resource filters must be validated public contracts.
- Standardize PATCH semantics: omitted preserves, `null` clears only where the schema explicitly allows it, arrays declare replacement behavior, and empty patches fail with a stable code.
- Use resource versions for optimistic concurrency and idempotency keys for retryable creates and other externally retried mutations.
- Add forward-only SQLite schema migrations before preserving external data. Version persisted events and upcast old payloads at read boundaries.
- Consolidate duplicate system/tenant user operations around one resource behavior with caller authorization context; do not keep compatibility aliases unless an existing documented public route requires a staged deprecation.
- Bind selected organization context to sessions and OIDC claims with explicit switching and tenant-isolation checks.
- Resource metadata is realm-scoped, feature-owned, typed as string key/value entries, and supports atomic set/delete/list plus inclusion and filtering in user and organization lists without N+1 queries.
- Device authorization follows OAuth 2.0 device flow semantics. Login provisioning creates and validates the required local login/OIDC client configuration idempotently.
- Narrow package exports to explicit public, client, server, and CLI surfaces before treating the package API as stable.

## Approach

- Stabilize shared failure, HTTP, startup, rate-limit, migration, pagination, mutation, and export contracts first.
- Migrate feature behavior incrementally, one feature or protocol boundary at a time, preserving tenant isolation and secret handling.
- Add metadata only after pagination/filter primitives exist.
- Add device authorization before Login V2-style provisioning so provisioning targets a complete protocol surface.
- Finish with cross-feature compatibility, deployment, migration, security, and built-output conformance.

## Tasks

- [ ] 1. Define the compatibility boundary and stable contract rules in package documentation: independent API status, error-code ownership, pagination, PATCH, concurrency, idempotency, rate-limit scope, migration support, and public export policy.
- [ ] 2. Extend the platform `ResultError` schema and constructors with stable `code`, subject-first `op`, safe message, and optional structured details while retaining secret-safe serialization.
- [ ] 3. Replace message-substring failure classification feature by feature with owned `{feature}.{slug}` codes and explicit HTTP/OAuth/OIDC mappings; add completeness and uniqueness checks for the code catalog.
- [ ] 4. Upgrade HTTP error responses and clients to preserve stable code, operation, details, status, request ID, retryability, and relevant headers without exposing secrets or parsing localized messages.
- [ ] 5. Normalize public origin and base-path resolution, wire configured host/port into `Bun.serve`, remove import-time database side effects, and make initialization failures terminate startup explicitly.
- [ ] 6. Add liveness and readiness endpoints; readiness must reflect successful configuration, schema migration, and database access.
- [ ] 7. Add replaceable in-memory rate-limit storage and middleware with bounded keys, deterministic windows, route/policy configuration, 429 errors, `Retry-After`, and rate-limit headers; cover cleanup and proxy/client-address trust.
- [ ] 8. Introduce versioned, forward-only SQLite schema migrations with startup locking, transactional application, backup/rollback expectations, and migration tests from every supported schema version.
- [ ] 9. Version persisted event payloads and add feature-owned upcasters at event read boundaries, including unsupported-version failures and replay tests.
- [ ] 10. Add shared validated cursor-pagination, filter, and sort contracts with deterministic tie-break ordering, bounded page sizes, opaque cursors, and client support.
- [ ] 11. Roll bounded pagination through every existing list action, repository, route, client, CLI command, and public response without introducing N+1 queries.
- [ ] 12. Standardize PATCH schemas and actions across features, including empty-patch rejection, explicit clearing/replacement semantics, and stable conflict/validation codes.
- [ ] 13. Add optimistic concurrency to mutable resources using expected versions/ETags and atomic compare-and-update behavior; return stable conflicts and expose fresh versions in responses.
- [ ] 14. Add scoped idempotency keys for externally retried mutations, with request fingerprinting, atomic result persistence, expiry, conflict handling, and tenant isolation.
- [ ] 15. Consolidate duplicate system/tenant user route behavior around resource operations plus authorization context, update clients/CLI, and add route and permission conformance tests.
- [ ] 16. Persist selected organization context in sessions, expose explicit switching, propagate the context into OIDC claims where requested, and enforce it through authorization and project-grant paths.
- [ ] 17. Add realm-scoped resource metadata persistence and user/organization actions for atomic set, delete, and paginated list, with key/value limits, indexes, events, isolation, and deletion behavior.
- [ ] 18. Add metadata routes, public schemas, clients, and CLI commands; support bounded metadata inclusion and indexed user/organization list filtering without N+1 queries.
- [ ] 19. Specify and enforce external-identity link retention, provider-disable/delete behavior, orphan reconciliation, and auditable cleanup.
- [ ] 20. Unify externally observable machine-token type, claims, authentication, rotation, revocation, and recovery semantics while preserving one-time secret return and audit safety.
- [ ] 21. Implement OAuth device authorization domain state and persistence: device/user codes, polling intervals, expiry, approval/denial, one-time redemption, client/scope binding, rate limits, and events.
- [ ] 22. Expose device authorization and token-grant routes, validated public contracts, typed clients, CLI/browser handoff behavior, discovery metadata, and protocol/security conformance tests.
- [ ] 23. Add idempotent Login V2-style provisioning for required login/OIDC clients and settings, then complete `prompt=none`, session, consent, assurance, organization-context, callback, and base-path behavior without adding the full ZITADEL settings model.
- [ ] 24. Replace wildcard package exposure with explicit supported public/client/server/CLI exports and compatibility tests that prevent persistence and feature internals from becoming public.
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
- `test/platform/`
- `test/features/`
- `test/conformance/`
- `test/cli/`
- `test/build/`
