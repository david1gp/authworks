# Org slug URLs: /orgs/{slug}/… and /realm/… replace /admin

## Goal

Every org-scoped admin page carries the organization in its URL path as a slug.
Realm/global pages live under `/realm/…`. `/admin` is removed as a page prefix
and only redirects. Code-style requires this: selected org/scope is navigation
state and must live in the URL path, not in memory, `?organization=` query, or
`localStorage` (`authworks.admin.scope`) as today.

## Decisions (user, 2026-11-08)

- URL shape: `/orgs/{slug}/users` for org pages, `/realm/{...}` for realm
  pages — shorter, replacing `/admin` entirely.
- `/admin` redirects depending on permissions (IAM/realm admin vs org owner).
- Old org-less deep links preserve their subpath: `/admin/users` →
  `/orgs/{defaultSlug}/users`. Bare entry points open the default org's org
  page (`/orgs/{defaultSlug}`) when the user is org-only.
- Slug lifecycle: auto-derived from the org name at creation, frozen on
  rename, explicitly editable in org settings. No old-slug redirect history.
- Slug format: lowercase, only `-` as special char:
  `^[a-z0-9]+(-[a-z0-9]+)*$`, max 64 (copy the team slug rule).

## Current state (explored)

- SolidJS `@solidjs/router`; production admin is a catch-all
  (`src/ui/UiRouter.tsx`, screen table `src/ui/production/productionRouteContractMap.ts`,
  strict segment matching in `productionRouteScreenSelect.ts`).
- Selected org today: server session + in-memory signal +
  `?organization=<id>` via `history.replaceState`
  (`productionApplicationContextsCreate.ts`); shell org/realm scope in
  `localStorage` (`productionAuthenticatedShellStateCreate.ts`).
- Organizations have no slug (`organizationTable.ts`: `UNIQUE(realm_id, name)`;
  DDL in `src/platform/storage/storageSchemaCreate.ts`, no migration runner).
  Teams already implement slugs — copy that precedent
  (`teamSlugNormalize.ts`, `teamSlugSchema.ts`, `directoryTeamSlugSuggest.ts`).
- API passes org as `:organizationId` path id everywhere and stays unchanged;
  the UI resolves slug→id from org lists it already loads
  (`GET /realms/:realmId/me/organizations`, realm-admin list).
- Default/fallback org today: session org → `?organization=` → domain
  discovery org → first membership. "contentoren" is a seeded org reached via
  domain discovery, not special-cased.
- Redirect insertion point: `productionAdminRedirectSelect.ts` +
  `ProductionRouteApp.tsx` (`navigate(target, { replace: true })`). Unknown
  paths render the existing `inaccessible` state panel.
- Zitadel import creates orgs directly (`zitadelMigrationImport.ts`
  `importOrganization`) — must derive slugs there too.

## URL mapping

Preserve every existing screen suffix verbatim; only the prefix changes.
Verify each suffix against `productionRouteContractMap.ts` when implementing.

- Org pages `/admin/<suffix>` → `/orgs/{slug}/<suffix>`:
  users, user-detail, roles, projects, project-detail,
  configuration/:section, machine-user-detail, machine-credentials,
  impersonation. `/orgs/{slug}` itself is the org page (organization-detail).
- Activity (org-optional today): canonical `/orgs/{slug}/activity` in org
  scope and `/realm/activity` in realm scope; nav links follow current scope.
- Realm pages `/admin/<suffix>` → `/realm/<suffix>`:
  organizations, realm-administrators, login-policy, oidc-clients(+detail),
  signing-keys, oidc-consents, protocol-documents, sessions, audit-events,
  whatsapp. The realm screen itself is `/realm` (not `/realm/realm`).
- Redirects (all `replace: true`):
  - `/admin/<org-suffix>/...` → `/orgs/{defaultSlug}/<org-suffix>/...`
  - `/admin/<realm-suffix>/...` → `/realm/<realm-suffix>/...`
  - `/admin` and `/orgs` → by permission: realm/IAM admin → `/realm`;
    otherwise `/orgs/{defaultSlug}` (org page). No org and no realm access →
    existing inaccessible panel.
  - Default org for redirects only: session org → domain-discovery org →
    first membership. URL slug always wins over session once present.
- `/orgs/{unknownSlug}/…` → existing inaccessible panel; never silently fall
  back to another org. Access for a known slug keeps existing guard rules
  (incl. realm-admin cross-org access).
- Org switcher: navigates to the same subpath under the new slug and still
  calls the session switch endpoint so server context stays in sync.
- Shell scope (org vs realm sidebar) is derived from the URL prefix;
  `localStorage` scope and the `?organization=` writer stop being sources of
  truth (remove them; keep no dual system).

## Slug (backend, organizations feature)

- New files, one export each, subject-first names, mirroring teams:
  `organizationSlugSchema.ts` (public, valibot),
  `organizationSlugNormalize.ts` / `organizationSlugSuggest.ts` (domain:
  lowercase, non-`[a-z0-9]` runs → `-`, trim `-`, empty → `organization`,
  max 64; reserved: `new`, `unassigned`).
- Persistence: `slug` column + `UNIQUE(realm_id, slug)` in
  `organizationTable.ts` and `storageSchemaCreate.ts` DDL. No migration
  runner exists: add the column idempotently for existing DBs (check for an
  existing ALTER precedent first) and backfill from name with `-2`, `-3`
  dedupe per realm, so seeded/imported orgs (e.g. contentoren) get slugs.
- Create: slug auto-derived from name (suffix `-2`… on conflict); no slug
  input on create. Rename (`organizationUpdate`) never changes slug; update
  accepts an optional explicit slug (validated, per-realm unique, conflict →
  existing catalog 409 pattern). Public `organizationSchema` gains `slug`.
- Zitadel import derives+dedupes slug from imported name.
- Org detail/settings UI gains a slug field next to the existing name edit.

## Tasks (delegate one increment at a time, verify each)

1. Backend slug: schema/normalize/suggest, persistence + idempotent
   column/backfill, create/update actions, public schema, Zitadel import,
   fixtures. Tests: slug unit tests + org create/update/backfill tests.
   Verify with targeted test files only.
2. Routing core: contract map `/orgs/{slug}/*` + `/realm/*`, router
   catch-alls (`/admin/*` becomes redirect-only), `orgSlug` route param,
   guard context resolves org from slug, all redirects above, unknown-slug
   handling. Update `test/ui/productionRoutes.test.ts` and
   `productionApplicationContexts.test.ts`. Targeted tests only.
3. Nav/UI wiring: shell navigation hrefs built from current slug, scope from
   URL prefix, org switcher slug navigation, remove `?organization=` writer
   + localStorage scope source, sweep every hardcoded `/admin` href in
   `src/features/**` and `src/ui/**`, org slug edit field. Targeted tests only.
4. Final validation (only in the last increment): update e2e specs that
   reference `/admin`, run full `bun run check` (tests
   `--max-concurrency=1` per AGENTS.md), browser smoke of redirect + switcher
   if the e2e harness covers it.

## Exclusions

- No API path changes (ids stay), no slug acceptance in API params.
- No realm slug, no team slug changes, no old-slug redirect history.
- No new libraries (use `package.json` only).

## Status

- Task 1: done (backend slug, backfill, import; targeted tests pass).
  Task 2: done (route table, slug guard, redirects; targeted tests pass,
  1 pre-existing failure confirmed on base).
  Task 3: done (nav/UI wiring: slug hrefs, URL-prefix scope, switcher slug
  navigation, `?organization=` writer and localStorage scope removed, sign-in
  canonical at `/realm/sign-in`, feature basePaths rebuilt from slug, org slug
  edit field, fixture residue fixed; targeted tests pass, tsc clean except e2e,
  biome clean; pre-existing failures confirmed on base, e2e left for Task 4).
  Task 4: done. `bun run check` green (format/typecheck/test/build/test:build;
  unit 2097 pass 0 fail; build-output 6 pass 0 fail). Local e2e: 179 of 180
  pass (incl. new redirect, unknown-slug, and switcher coverage); the 1 failure
  (emailPreview) is pre-existing, confirmed identical on clean HEAD. Live
  workflow suites need a live target and were not run. Fixes: e2e slug fixtures
  and canonical URLs, bootstrap tenant-list slug resolution, demo audit link
  keeps /events, Task 1 format and stale org-mock residue fixed. Worktree:
  `/tmp/authworks-orgslug-mFhnRL` on branch `feat/org-slug-urls` (from main @
  46666539; unrelated dirty whatsapp files in the main checkout are out of
  scope).
