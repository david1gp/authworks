# API contract cleanup

## Goal

Make the independent Hono/Valibot identity API safer to evolve by fixing error contracts, list pagination, PATCH semantics, startup wiring, and package exports. Keep alpha reset-only storage. Do not add schema migrations, event upcasters, resource metadata, device authorization, Login V2 provisioning, rate-limit infrastructure, or ZITADEL wire compatibility.

## Decisions

- This is an independent identity API. It is not ZITADEL API v2, not a client, and not a protobuf/ConnectRPC compatibility layer.
- The alpha reset-only rule stays. Destructive schema changes and database resets remain allowed. Do not add migration versions, upgrade paths, backups-before-mutate, or event payload upcasters.
- Canonical internal failures use `ResultError`. Stable codes use `{feature}.{slug}`. Messages never determine codes or HTTP status. OAuth/OIDC protocol errors stay standards-compliant and separate from management API errors.
- Every list uses one cursor envelope `{ items, nextPageToken }`, a hard maximum page size, deterministic tie-break ordering, and validated public filter/sort contracts.
- PATCH semantics are one rule across features: omitted preserves, `null` clears only where the schema allows it, arrays declare replacement, empty patches fail with a stable code.
- Public origin and base-path resolution must preserve a configured pathname. Configured host and port are passed into `Bun.serve`. Import-time database initialization is removed. Initialization failure terminates startup.
- Keep the folder name `public/`. It is the transport-contract directory, not the published package. Do not rename it to `library`. `library` stays the output composition in `src/outputs/library/`.
- `public/` is a closed import graph. Files there may import Valibot, other files in the same feature `public/`, another feature's `public/` only, and shared platform transport contracts (`Result` types, HTTP error schema). They may not import `domain/`, `actions/`, `persistence/`, `events/`, `server/`, or `client/`. Domain enums that are part of the HTTP resource move into `public/`. Action or persistence helpers currently living under `public/` move out.
- Each feature gets a `public/index.ts` barrel that re-exports only that closed contract. The published feature subpath is that barrel plus the feature `client/`. Clients stay outside `public/` because they depend on public schemas and platform HTTP, not the reverse.
- Package exports are an explicit allowlist. `.` is a thin root: `packageName` plus shared result and HTTP error contracts. `./library` aliases `.`. Named feature paths stay (`./users`, `./organizations`, `./oidc`, and the other current feature barrels). `./server` and `./cli` stay executable entries. `./package.json` stays. Delete `./features/*` and `./*`. Do not publish `src/features/<feature>/public` as a package path.
- Health/readiness, optimistic concurrency, idempotency keys, user-route consolidation, organization-claim binding, metadata, device flow, and Login provisioning stay out of this plan.

## Approach

- Document the compatibility boundary and the contracts this plan will change, then implement shared error and HTTP contracts before touching feature routes.
- Add pagination primitives next and roll them through every existing list in one pass so no list is left unbounded.
- Standardize PATCH after list contracts exist.
- Close `public/` import graphs and add per-feature public barrels before changing `package.json`. Then replace wildcard exports with the allowlist so the published surface matches the cleaned contracts.
- Tests stay beside the code they cover. Source tests may still import internals. Cheap package-export and `public/` import-graph tests run under `bun test`. Tests that need `dist` live in `test/build/` and are not part of the default `test` script. Add `test:build` as `bun run build && bun test test/build`, and `test:all` as `bun test && bun run test:build`. `check` runs format, typecheck, `bun test`, build, then `bun test test/build` so it does not build twice.

## Tasks

- [x] 1. Document in `README.md` that this is an independent Hono/Valibot API, not ZITADEL-compatible; that storage remains reset-only until a later plan preserves a database; and the contracts this plan will stabilize: error codes, HTTP error shape, pagination envelope, PATCH rules, origin/base-path/startup behavior, closed `public/` graphs, and the package export allowlist. Documentation only.
- [x] 2. Align the platform `ResultError` type, schema, and constructors so coded failures carry a stable `code`, retain subject-first `op` and `errorMessage`, and accept optional explicitly safe structured details. Keep a temporary path for uncoded callers until task 3 migrates them.
- [x] 3. Replace message-substring failure classification feature by feature with owned `{feature}.{slug}` codes and explicit HTTP/OAuth/OIDC mappings. Add catalog completeness and uniqueness checks.
- [x] 4. Upgrade HTTP error responses and clients to preserve code, operation, details, status, request ID, retryability, and relevant headers. Do not parse localized messages or expose secrets.
- [x] 5. Normalize public origin and base-path resolution so a configured pathname is kept, wire configured host and port into `Bun.serve`, remove import-time database side effects, and terminate startup on initialization failure.
- [x] 6. Add shared validated cursor-pagination, filter, and sort contracts with deterministic tie-break ordering, a hard maximum page size, opaque cursors, and client support.
- [x] 7. Apply the shared list envelope through every existing list action, repository, route, client, CLI command, and public response without N+1 queries.
- [x] 8. Standardize PATCH schemas and actions across features, including empty-patch rejection, explicit clearing and array-replacement semantics, and stable validation codes.
- [x] 9. Close every feature `public/` graph: move HTTP-facing domain enums into `public/`, move action and persistence helpers out of `public/`, and add `public/index.ts` barrels that re-export only the closed contract. Feature library barrels re-export that index plus the feature client. Thin the root `src/outputs/library.ts` to `packageName` and shared result/HTTP error contracts.
- [x] 10. Replace wildcard package exports with the explicit allowlist: `.`, `./library`, named feature paths, `./server`, `./cli`, and `./package.json`. Remove `./features/*` and `./*`. Add source tests under `bun test` that assert the exact `package.json` export keys, reject any `*` export, and walk `src/features/*/public` for imports of `domain/`, `actions/`, `persistence/`, `events/`, `server/`, or `client/`. Add `test:build` and `test:all` scripts. Put dist-walking and forbidden package-subpath imports in `test/build/`, including a walk of `dist/library` that fails on those same internal path segments and a failed import of `@adaptive-ds/authworks/features/users`. Change `test` so it does not run `test/build/`. Keep `verify:outputs` or fold it into `test:build`. Point `check` at format, typecheck, `bun test`, build, then `bun test test/build`. Source tests may still import `src` internals.
- [x] 11. Add error-catalog, pagination, PATCH, startup, isolation, client, CLI, and built-output conformance for the contracts in this plan. Update consumer documentation to match the allowlist.

## Paths

- `README.md`
- `package.json`
- `docs/20260818_api-contract-cleanup.md`
- `src/platform/errors/`
- `src/platform/http/`
- `src/platform/configuration/`
- `src/outputs/server.ts`
- `src/outputs/library.ts`
- `src/outputs/library/`
- `src/outputs/cli.ts`
- `src/compositions/serverApplicationCreate.ts`
- `src/features/*/public/`
- `src/features/*/client/`
- `test/libraryExports.test.ts`
- `test/build/distributableOutputs.test.ts`
- `test/platform/`
- `test/features/`
- `test/conformance/`
- `test/cli/`
