# Admin redesign — fix all open points

## Goal

Close the four open points left by the admin redesign (2026-11-06):

1. Translate **all** untranslated UI text in the 14 non-English locales (user decision: full backlog, not only the 39 redesign keys).
2. Configuration › General: metadata becomes an inline editable table instead of a read-only list + add-only form.
3. Signing keys: add a real expiry — **persisted `expiresAt`** (user decision) — and an "Expires" column.
4. Session search filters server-side across the whole realm, not only the loaded page.

## Decisions (settled with user 2026-11-07)

- i18n scope: **all** keys whose locale value is byte-identical to English, except an explicit allowlist of legitimately identical values (see Task 4). New keys added by Tasks 1–3 are included (translation runs last).
- Signing-key expiry: **persisted column**, set at create/rotate/ensure to `createdAt + 365 days`; backfill existing rows the same way. Constant lives next to key material (`oidcSigningKeyValidity*`), single source.
- Session search: URL param `?q=` (projects/directory precedent), debounced write via `authenticatedUrlSearchParamWrite`; match fields = current client filter (`subjectDisplayName`, `subjectEmail`, `subjectId`, `device.ipAddress`, `device.region`, `device.countryCode`) **plus** session `id` and `userName`. No `userAgent`.
- Metadata: key is PK — never editable in place; value editable per row; rename stays remove + add.

## Context from exploration (verified 2026-11-07)

- Locales: `public/i18n/{ar,de,es,fr,hu,it,ja,nl,pl,pt,ru,tr,uk,zh}.csv` (2-col `key,{locale}`, quote values with `,`/`"`/newlines). English source: `src/ui/i18n/model/englishCatalog.ts`. No i18n lib/tooling; placeholders `{name}`/`{0}`/legacy `[X]` must be preserved exactly; plurals are separate keys (translate both forms). Parity + placeholder tests: `test/ui/i18n.test.ts`. Redesign commit `0ae0b93` added 40 keys, 39 still English in all 14; full backlog ≈388–516 keys/locale.
- Metadata UI: `src/features/organizations/ui/OrganizationConfigurationGeneralSection.tsx:106-181`; API already supports upsert/remove (`organizationMetadataSet/Remove/List`), no API change. Mirror provider inline-edit pattern in `OrganizationAdminLoginPolicyView.tsx:482-560` + `organizationAdminFormStateCreate.ts` (`providerEdits` map). Fix global `pendingId "metadata:set"` → per-key `` `metadata:${key}` `` in `organizationAdminPageStateCreate.ts:318-340`.
- Signing keys: raw RSA via `node:crypto` (`oidcKeyMaterialCreate.ts`), no cert/expiry exists anywhere. Touch: `oidcSigningKeyTable.ts`, DDL `src/platform/storage/storageSchemaCreate.ts:712-719` (+ `ALTER TABLE … ADD COLUMN` try/catch migration per existing `storageSchemaDuplicateColumnIsExpected` pattern, backfill `createdAt + validity`), `storageDatabaseReset.ts`, repository, write actions (`oidcSigningKeyCreate`, `oidcSigningKeyEnsureActive`, CLI ensure paths), `oidcSigningKeySchema.ts` (+ `expiresAt`), `oidcSigningKeyPublicViewCreate.ts`, demo fixture/adapter (`demoAdminOidcSigningKeys.ts`, `oidcAdminDemoAdapterCreate.ts`), view `OidcAdminSigningKeysView.tsx` (Expires column after Created, `AuthenticatedRelativeTime`, mobile RecordItem too), i18n `admin.oidc.keys.expires`. Label must not imply crypto expiry — retired keys still verify old tokens.
- Sessions: client filter in `src/features/admin/ui/adminPageStateCreate.ts:214-231`; page size 20, cursor `pageToken`. API `sessionList.ts` ignores `query.search` (route/client already transport it). Mirror `userList.ts:49-50,88-100` filter-then-paginate; enrichment `userSessionDisplayList` must move **before** `listRowsPage` so name/email match pre-pagination. UI mirror `projectAdminScreenStateCreate.ts:57-61` + `listSignature` pageToken reset. Demo adapter `adminSessionDemoAdapterCreate.ts` ignores query — must honor `search` (+ existing pageSize/pageToken behavior).

## Tasks

All work in the worktree from Task 0. Subagents: smallest correct change, existing `package.json` libraries only, no new deps. Follow `code-style` skill + `AGENTS.md` (Bun, Biome, tests `--max-concurrency=1` semantics, run only targeted tests per task; full `bun run check` only in Task 6). New English catalog keys must be added to all 14 CSVs (English value) in the same task so parity tests stay green.

### Task 0 — Worktree setup
`git worktree add` a mktemp dir on branch `fix/admin-open-points` from `main`; copy `.env*` if present; `bun install`; copy this plan into the worktree `docs/`. Return worktree path + branch. No code changes.

### Task 1 — Server-side session search
API (`sessionList` filter before pagination incl. id/userName), UI (`?q=`, debounce, reload key, pageToken reset, delete local filter; keep count label honest), demo adapter honors `search`. Tests: extend `test/features/sessions.test.ts` (search by name/email/IP/id, case-insensitive, search+pagination), `src/features/admin/ui/adminSessionList.test.ts` (query forwarding, reset, verbatim render, demo search). Targeted tests only.

### Task 2 — Metadata inline table
Per Context above: table Key | Value(input) | Save(dirty-only)/Remove; add-row at bottom reusing validation; `metadataEdits` draft map mirroring `providerEdits`; per-key pendingId; keep confirm-on-remove, 50-cap error surfaced, `canEdit` gating, mobile parity, e2e-visible strings (`Remove`, `Key`, `Value`) stable. Tests: extend `test/ui/organizationConfigurationMetadata.test.ts` (edit-in-place version bump/`createdAt` preserved, add-row). Targeted tests only.

### Task 3 — Persisted signing-key `expiresAt` + Expires column
Per Context/Decisions above incl. migration + backfill. Tests: migration on old-schema DB gains column + backfill value; create/rotate/ensure set `expiresAt = createdAt + 365d`; update schema fixtures (`test/ui/oidcAdminDemoAdapter.test.ts`, `oidcAdminApi.test.ts`, `oidcAdminPageState.test.ts`, `test/features/oidc*.test.ts`, `test/cli/oidcProductionSigningKeyEnsure.test.ts` as needed); view test for Expires rendering. Targeted tests only.

### Task 4 — i18n inventory + allowlist (after Tasks 1–3)
Script (Bun, reuse approach of `/tmp/i18n-untranslated-check.ts`): compare every locale CSV vs `englishCatalog`; write `/tmp/i18n-todo/{locale}.json` = `{key: english}` for byte-identical cells and `/tmp/i18n-todo/summary.json` (counts). Propose `identicalAllowlist`: values legitimately identical in (almost) all locales — brand/product names, acronyms (`OIDC`, `IP`, `ID`, `URL`, `API`…), placeholder-only/format strings, single symbols/units — each with reason; reuse any allowlist already in `test/ui/i18n.test.ts`. Also extend `test/ui/i18n.test.ts`: new assertion that **no** key outside the allowlist stays English-identical in any locale (this test is expected RED until Task 5 finishes; add it in Task 5's final step if it would block intermediate work — decide and report). Return counts + allowlist; no translations yet.

### Task 5 — Translate all locales (14 parallel subagents, one per locale)
Each: read `/tmp/i18n-todo/{locale}.json`, translate every entry into that locale in `public/i18n/{locale}.csv` only. Preserve placeholders exactly, CSV quoting, key order, both plural forms, tone consistent with already-translated rows in the same file (read samples first). Allowlisted/already-correct cognates: keep identical only if genuinely correct in that language, and list kept-identical keys in the return. No other files. Verify: run the Task 4 script filtered to own locale → 0 remaining outside allowlist + kept list; run `bun test test/ui/i18n.test.ts` (parity/placeholders). Large locales may be split by key prefix if >~450 entries.

### Task 6 — Verify + ship
- `bun run check` in worktree (format, typecheck, tests max-concurrency 1, build). Fix failures via fresh subagents scoped to the failing file.
- Browser check (managed/repo e2e only, no ad-hoc server per AGENTS — prior thread used repo e2e against dev target on a dedicated port): targeted specs for sessions/metadata/signing-keys + admin workflows if labels changed.
- `/commits` skill → merge `fix/admin-open-points` into `main` → cleanup worktree/branch/servers → e2e on dev/preview → fix → commits → `git push`. Deploy only if user asks (not requested yet).

## Status

- [x] Task 0 worktree — `/tmp/authworks-open-points.O51hLJ`, branch `fix/admin-open-points`
- [x] Task 1 session search — targeted tests green (11 + 17 + 14)
- [x] Task 2 metadata table — targeted tests green (11). Known issue: `bun run typecheck` reports 2 errors in Task 1 file `src/features/admin/ui/adminSessionList.test.ts` — fix before Task 6.
- [x] Task 3 signing-key expiry — targeted tests green (5 new + 150 across oidc/cli/ui files). DDL backfill uses documented literal of the 365d constant (DDL can't import).
- [x] Task 4 i18n inventory — 577 distinct keys / 7197 cells after 12-key allowlist (`/tmp/i18n-todo/`). Typecheck fix for Task 1 test also done (0 errors). Task 5 method: translators write `/tmp/i18n-done/{locale}-{part}.json` only (ar/de single, other 12 split A/B by sorted key half); one apply step merges into CSVs + adds the no-English-copy test (incl. `tr/demo.nav.label` carve-out) after all locales land.
- [x] Task 5 translations — all 14 locales merged into CSVs; remaining identical = 12-key allowlist + documented cognates only; new no-English-copy test green (21 tests, ~96.7k assertions). de `inh` fixed to `geerbt`. 3 hu boundary keys filled.
- [x] Task 6 verify + ship — `bun run check` + targeted e2e green; shipped via `fix/admin-open-points` merge

Current context: exploration complete; decisions settled (full i18n backlog, persisted expiry). Tasks 1–3 are mutually disjoint except `englishCatalog.ts` key additions — run sequentially to avoid catalog conflicts. Task 5 locales are disjoint files — parallel.
