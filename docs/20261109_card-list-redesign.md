# Card list redesign

## Goal

Replace admin tables with cards across the authworks admin UI. Pilot first (Users,
Organizations, Sessions), before/after screenshots per page, user review, then rollout.

## Decisions (final, user-approved)

- Scope: pilot = Users + Organizations + Sessions; phase 2 = all remaining pages,
  only after the user approves the pilot screenshots.
- Layout: cards REPLACE tables (no toggle). Search, filters, sorting, pagination,
  bulk/row actions are preserved (card toolbar/header/footer/menu).
- Deliverable: work stays on branch `feat/card-list-redesign` (this worktree).
  Screenshots before/after per page, desktop 1440px + mobile 390px, demo routes
  (`/demo/admin/*`). Stop for user review after the pilot. No merge, no push.
- Implementation delegated to subagents; individual card redesigns use Opus
  (`cliproxyapi/claude-opus-5-5` via OpenCode, fallback Pi, then delegate-skill default).

## Users card requirement

Each user card shows name, username, email, phone with a copy icon-button to the
right of each field (fast copy, brief copied/check feedback; copy click must not
trigger card navigation). Clicking the card opens the user detail view. The copy
pattern generalizes to copyable identifiers on other pages (org slug/id, session
id, client id).

## Pilot pages

| Page | View | Demo route | Pattern |
| --- | --- | --- | --- |
| Users | `src/features/directory/ui/DirectoryAdminUsersView.tsx` | `/demo/admin/users` | copy fields + detail click |
| Organizations | `src/features/organizations/ui/OrganizationAdminListView.tsx` | `/demo/admin/organizations` | simple entity + detail |
| Sessions | `src/features/admin/ui/AdminSessionListView.tsx` | `/demo/admin/sessions` | status/action-heavy, no detail |

## Tasks

- [x] Task 0 — Explore UI system (`ui/table/*`, existing cards, UI kit demo, 3 pilot
  views) and propose the shared component design. No code changes.
- [x] Task 1 — Before screenshots of the 3 pilots → `docs/card-redesign-screenshots/before/`.
  Must precede any pilot code change.
- [x] Task 2 — Shared card primitives per Task 0 design (copy-field button, entity
  card, card-list container/empty state).
- [x] Task 3 — Users card redesign (preserve toolbar/tabs/dialogs/actions/pagination).
- [x] Task 4 — Organizations card redesign.
- [x] Task 5 — Sessions card redesign.
- [x] Final — After screenshots → `docs/card-redesign-screenshots/after/`, run
  `bun run check`, hand back before/after pairs for user review.

## Component design (from Task 0, validated)

Placement: `ui/` is vendored from solid-ui (read-only, overwritten on sync) — never
add files there. Shared primitives go in `src/ui/authenticated/`; domain cards in
each feature's `ui/`. The vendored `ui/table/table1|2|3` system has zero `src/`
consumers — ignore it. Pilots use `#ui/table/Table.jsx` + `AuthenticatedDataTable`
with server-side cursor pagination (pageSize 20); only View JSX changes, no
`*StateCreate` API changes. No bulk select / virtualization exists in any pilot.
Icons: MDI paths from `@adaptive-ds/mdi` (`mdiContentCopy`, `mdiCheck`, `mdiAt`,
`mdiEmailOutline`, `mdiPhoneOutline`, `mdiArrowUp/Down` verified present).

Shared primitives (one export per file, `src/ui/authenticated/`):

- `AuthenticatedCopyButton.tsx` + `authenticatedCopyButtonStateCreate.ts` — copy
  semantics from `accountIdentityCopyStateCreate` (copied/failed feedback, ~2–3s
  reset, injectable `writeText` test seam, `stopPropagation`+`preventDefault`).
- `AuthenticatedCopyField.tsx` — one card row `[icon?] [label?] value [copy btn]`
  (button inline-end, `relative z-10`); `identifier` mode = mono + middle-truncate;
  empty value → fallback ("—") with no button, or row hidden per caller.
- `AuthenticatedEntityCard.tsx` + `authenticatedEntityCardStateCreate.ts` —
  stretched-link pattern (title `<A>` with `after:absolute after:inset-0`, exactly
  one tab stop, new-tab/middle-click works); interactive children `relative z-10`.
  Slots: leading, title, status, actions, children, footer; `entityId` →
  `data-entity-id`; no href/onActivate → non-interactive (Sessions).
- `AuthenticatedCardList.tsx`, `AuthenticatedCardListSkeleton.tsx`,
  `authenticatedCardClasses.ts` — `<ul>` grid at all widths (`sm:2 / 2xl:3` cols),
  replacing the desktop-table + mobile-RecordList dual render with one render.
  Empty states stay as existing branches (`AuthenticatedEmptyState` etc.).
- `AuthenticatedSortSelect.tsx` + state — replaces Users' sortable headers so
  `?sort=&dir=` survives (options: userName, lastSignInAt, createdAt; default
  lastSignInAt desc). Reuses `AuthenticatedDataTableSort` type unchanged.
- i18n: add `ui.authenticated.copyField` ("Copy {field}"), `.copied`,
  `.copyFailed`, `.sortAscending`, `.sortDescending` to `englishCatalog.ts`
  (MessageKey is derived from it; `uiTextLiteralsCheck` enforces).
- UI kit demo: add a "Cards" section (visual spec for screenshot review); keep
  the existing DataTable section.

Feature-local cards: `DirectoryUserCard.tsx`, `OrganizationAdminCard.tsx`,
`AdminSessionCard.tsx` (pure views, no new state).

Coordinator decisions:

- Users: the NAME also gets a copy button (adjacent to the title text, `z-10`,
  stops navigation) — the requirement lists name explicitly. Copy fields:
  name, username (`@` display, raw value copied), email (unverified dot kept),
  phone.
- Users phone: required field, so Task 3 includes the additive contract change —
  optional `phoneNumber` in `directoryUserSchema`, mapping in
  `directoryUserViewCreate`, demo fixtures with phone numbers. Card hides the
  row when a user has no phone.
- Sessions e2e: `e2e/organizationAdminProduction.spec.ts:345` uses
  `getByRole("row")` — rewrite to `[data-entity-id="…"]` in the same task as the
  Sessions conversion (e2e not run until final check).
- Pilot converts the Users people tab only; teams/service-accounts/invitations
  tabs keep tables until phase 2 (their e2e depends on `getByRole("table")`).
- Unit tests are state-factory level (no table-DOM assertions) → no blockers if
  `*StateCreate` APIs and URL params are preserved. New test:
  `authenticatedCopyButtonStateCreate.test.ts` (fake `writeText`).

## Phase 2 (after pilot approval)

Roles, Realm administrators, Organization detail (inner tables), Projects, Project
detail tabs, Machine user list (Users `?tab=service-accounts`), Machine credentials,
OIDC clients, Signing keys, Consents, Audit events, Realm overview recent-events,
WhatsApp tables, User detail inner tables, UI kit showcase entries.

## Constraints

- Repo rules in `AGENTS.md`: Bun, `bun run check`, Biome, explicit `.js` import
  specifiers, feature boundaries, tests beside features, max test concurrency 1.
- Code style: one export per file, subject-first names, view-only `.tsx` (state in
  `<name>StateCreate.ts`), `createSignalObject`, Result instead of throws.
- No new dependencies; use libraries already in `package.json`.
- No literal UI text violations (`scripts/uiTextLiteralsCheck.ts`); follow existing
  text patterns.
- Screenshots: demo routes only; dev UI via `bun run dev:ui` (`UI_PORT`, default
  5173; free port if busy; never kill other sessions' servers).

## Pilot outcome (2026-11-09)

- `bun run check` passes on this branch (2099 tests; builds green). Note: the
  branch also adds the 2 pre-existing missing i18n CSV rows
  (`directoryShow/HideDeleted`) that made the test red on `main`.
- Screenshots: `docs/card-redesign-screenshots/{before,after}/` (PNGs are
  git-ignored globally; commit needs `git add -f` if they should be versioned).
- Known pre-existing demo quirks (unchanged hrefs, not caused by the pilot):
  demo user profile errors `users.not-found` (list fixtures `…101` vs profile
  demo `…021–023`); demo org card navigates to `/orgs/<slug>` (production
  route), as the old name link did.
- Status: waiting for user review; phase 2 not started.

## Compact redo (user feedback: cards must be compact/space-efficient)

- `AuthenticatedCopyField` is inline now: copy button immediately right of the
  value (20px button), no far-edge pinning. Card chrome: `gap-1.5 p-3`, list
  `gap-2 p-2 items-start`, 3 columns from `xl` (1440px).
- Users card = header + wrapping field line (username/email/phone) + one meta
  line (roles, team, last-sign-in/created). Grid ≈1.3× table height (v1 ≈2.5×).
- Organizations = header (status + created column) + slug/id line.
- Sessions = header + one wrapping flow (identity, session ID, IP, location,
  times). Rule: compactness never hides data — only identifiers middle-truncate
  (first8…last4, copyable); everything else wraps.
- `after-v1-spacious/` keeps the first iteration's screenshots.

## Redo 2 (user feedback: no white wrapper; Users two-column)

- Card lists sit directly on the page background (the `AuthenticatedSection`
  white panel around each list became a plain div in the 3 pilot views; list
  padding removed). `AuthenticatedSection` itself unchanged for other pages.
- Users card: left (wider) column = username/email/phone stacked with adjacent
  copy buttons; right (narrower, content-width `auto`, max 11rem) column =
  roles, team, last-sign-in, created. Below `sm` it stacks to one column.
- `AuthenticatedCopyField` non-identifier values wrap instead of ellipsis-cut.
