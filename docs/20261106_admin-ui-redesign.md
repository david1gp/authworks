# Admin UI redesign: dense, compact, useful

## Goal

Redesign every `/admin/**` page (and its `/demo/admin/**` mirror) so it is dense, compact, scannable and more useful
for operators, without changing account or sign-in end-user pages.

## Decisions

- **Admin-only density.** Shared primitives in `src/ui/authenticated/` get compact styles only under
  `[data-density="compact"]`. Account and sign-in pages must look unchanged.
  - Add a Tailwind v4 custom variant in `src/ui/styles.css`:
    `@custom-variant compact (&:where([data-density=compact], [data-density=compact] *));`
  - Set `data-density="compact"` on the admin `<main>` in `src/ui/production/ProductionAuthenticatedShell.tsx` (admin
    kind only) and on the demo admin `<main>` in `src/features/admin/ui/AdminDemoApp.tsx`. Also set it on the admin
    sidebar so navigation is compact.
  - Primitives add `compact:` utility overrides. They do not fork components.
- **Dates (user feedback).** Admin tables and fact strips use short notation, with no "ago": `now`, `5m`, `2h`,
  `6d`, `3mo`, `2y`. Future dates are written as `in 3d`. The absolute local date and time appear in the native
  `title` tooltip.
  - Provide this as an opt-in short format on `AuthenticatedRelativeTime` (a prop, or automatic under compact
    density).
  - Account pages keep their current format.
- **Small API additions allowed** where they make a page more useful (Task 3). Keep public transport schemas separate
  from persistence rows. Demo adapters and fixtures must be updated to match.
- **Navigation restructure.** Routes stay the same. The sidebar uses grouped sections that are always expanded:
  - **Organization:** Users, Roles, Projects, Configuration, Impersonation, Activity
  - **Realm:** Overview, Administrators, Organizations, Login policy
  - **OIDC:** Clients, Signing keys, Consents, Protocol documents
  - **Security & audit:** Sessions, Audit events
  - Show the Realm, OIDC and Security groups only when the current guards allow them, as today.
- **Keep e2e and a11y contracts stable.** Do not rename these accessible names, labels, headings, links or texts (they
  are used in `e2e/workflows/admin*/`):
  - Sign-in and sign-out: `Username or email`, `Password`, `Sign in`, `Sign out`
  - Users: heading `Users`, searchbox `Search`, `Roles and access`, role radios `Owner`, `Admin`, `Member`, `Guest`
  - Invitations: `Pending invitations`, `Invite user`, `Revoke invitation`, `Continue`, `Send invitation`,
    `I saved this link`, `Email address`
  - Configuration: heading `Configuration`, `Save`, region `Sign-in preview`
  - Roles and access: `Assign project roles`, listbox `Project`, `Save assignments`
  - Project detail: nav `Project detail`, links `Overview`, `Roles`, `Applications`, `Access`
  - Roles page: heading `Roles`, links like `Organization owner · 1 member`
  - Activity: links `Administration`, `Activity`, heading `Activity`
  - Realm administrators: heading `Realm administrators`, `Add administrator`, `Search administrators`, `Remove`,
    `Remove administrator`
  - Organizations: `Create organization`, `Organization name`, `Members and roles`
  - All success and notice texts stay as they are.
  - Each page keeps exactly one visible `main h1`, has no duplicate named landmarks, and has no serious or critical axe
    violations.
- Use only existing dependencies (`solid-js`, `@solidjs/router`, `@adaptive-ds/mdi`, `@corvu/*`, `cn`, Tailwind).
  Do not add libraries.
- Follow the `code-style` skill and AGENTS.md: one export per file, view-only `.tsx`, feature boundaries, `.js` import
  specifiers.

## Visual spec (compact mode)

- **Type:** body and table text 13px (`text-[13px]`). Labels and meta text use `text-xs`. Page title is
  `text-lg font-semibold`. Section title is `text-sm font-semibold`. Mono IDs use `text-xs`.
- **Page header:** one row with the h1, an inline muted count or summary, and the actions aligned right. Total height is
  about 40px. Drop generic subtitle sentences. Keep a description only if it gives real information. Remove large
  vertical gaps: page body `gap-3`.
- **Content area:** full width with no max-width cap for admin. Padding `px-4 py-3` (`sm:px-5`).
- **Tables (`AuthenticatedDataTable`):**
  - Header row 32px with `text-xs` muted text and a sticky header.
  - Body rows about 36px: cells `px-3 py-1.5`, single line, `truncate` with a `title` attribute.
  - Rows get a hover background. Clickable rows look clickable.
  - Avatars are 24px. The person cell shows the name, then the email muted on the same line or as a second tight line.
  - Numeric and date columns are right-aligned and use `tabular-nums`.
  - Row actions are icon buttons (28px) with `aria-label` and `title`. Multiple actions go in an overflow menu.
- **Sections and cards:** header `px-4 py-2`, body `px-4 py-3`, radius `rounded-lg`. The description is one muted
  `text-xs` line. Prefer fewer, merged sections over many stacked cards.
- **Forms:**
  - Inputs, selects and buttons are `h-8` with `text-[13px]`. Small buttons are `h-7`.
  - Settings pages use a "settings row" layout on md and up: label and help text in a left column (about 240px), the
    control on the right, and dividers between rows.
  - Long forms (OIDC client) get grouped sub-sections and a sticky footer action bar (Save, Discard) that is visible
    while the form is dirty, or always.
  - Checkbox groups are inline wrapped chips.
- **Status pills and chips:** `text-2xs`, `px-1.5`, `leading-4`. Use a dot plus text. Do not stack more than two pills.
- **Tabs:** `px-2.5 py-1.5 text-[13px]` with counts in a muted badge.
- **IDs:** a new primitive `AuthenticatedCopyableId`: mono text truncated in the middle (`0190…0041`), the full value in
  the title, and an inline copy icon button with `aria-label` "Copy <label>". Use it everywhere a UUID or secret
  identifier is shown.
- **Detail pages:** a compact header with the name, status, copyable ID and actions (the primary action is visible,
  others go in an overflow menu). Below it, a key facts strip in one row of small label/value pairs. On `xl` screens,
  use two columns: main content (tabs and forms) plus a right rail (about 320px) with facts, metadata and the danger
  zone.
- **Empty states:** a single compact line with an icon, text and a primary action. No big illustrations.
- **Dialogs:** compact padding (`p-4`), `h-8` controls, and the footer actions aligned right.
- **Sidebar:** width about 224px. Items are `h-7` with `text-[13px]` and 16px icons. Group labels are `text-2xs`
  uppercase and muted. The active item gets an accent background.
- **Dark mode:** must keep working. Use the existing semantic tokens only, with no hardcoded colors.

## Page-specific improvements

- **Users:**
  - The filter row is a single line: search, role segmented filter with counts, and scope select.
  - Columns: User (avatar, name, email), Username (mono), Role, Status (one pill, plus a warning dot with a tooltip for
    unverified email), Last sign-in, Created.
  - Rows are about 36px, so all 13 fit above the fold.
- **User detail:**
  - The header merges the profile header and the facts.
  - Overview uses a 3-column dense field grid.
  - Roles and Security tabs use compact tables.
- **Roles:** compact grouped list showing the role, member count and member avatars inline.
- **Realm administrators:** compact table with the add action in the header.
- **Projects and project detail:** table with counts (applications, roles, grants). Detail uses compact tabs and tables.
- **Configuration (general, branding, sign-in, domains):**
  - Settings-row layout.
  - Status merges into the page header.
  - Organization ID uses CopyableId in the header or facts strip.
  - Metadata becomes an inline editable key/value table.
  - The danger zone moves to the bottom as a compact row.
- **Login policy:** settings rows with grouped sub-sections and a sticky save bar.
- **Organizations and organization detail:** table with status, created date and member count if available. Detail
  follows the standard detail layout.
- **OIDC clients:** table with name, type, project, redirect count, status and updated date.
- **OIDC client detail:**
  - Header with name, status, copyable client ID, type and created/updated facts.
  - Grouped sections: General, Redirects & origins, Tokens, Grants & scopes, Consent & trust.
  - Sticky save bar.
  - The secret panel and danger actions go in the right rail on `xl`.
- **Signing keys:** table with key ID (copyable), algorithm, status, created, expires and a rotate action in the header.
- **Consents:** table with the revoke icon action.
- **Protocol documents:** compact link and copy rows with collapsible JSON preview.
- **Machine user detail and machine credentials:** standard detail layout. Credential table and issue form are compact.
- **Impersonation:** compact form plus a table of active and recent impersonations, if the data is available.
- **Realm overview:**
  - Header with the realm name, status and Edit.
  - Facts strip: copyable ID, primary domain, domains as chips.
  - Replace the large "Explore" cards with a row of `AuthenticatedStatTile` counts (organizations, users,
    administrators, OIDC clients, active sessions, events in the last 24 h) that link to the pages.
- **Sessions:**
  - Real table: Device, User (name and email instead of the subject UUID), IP (mono), Location (region, country),
    Last used, Expires, Revoke icon action.
  - Search filter and a count in the header.
- **Audit events:**
  - Filter bar on one row: event type, aggregate, actor, date range, plus a "More filters" toggle for aggregate ID and
    user subject.
  - The count, Export and Clear actions sit in the page header.
  - Table: Occurred, Event type (mono chip), Aggregate (type plus copyable ID), Actor (display name or System, with ID
    in the title).
  - The payload expands inline in the row with a chevron, as a pretty-printed JSON block.
- **Activity:** compact timeline or table rows with the same date treatment.
- **Admin sign-in:** keep it functional and center a compact card. It is low priority and must not break the e2e
  labels.

## Tasks

Status: `todo` | `doing` | `done`

1. `done` **Foundation.**
   - Files: `src/ui/styles.css` (compact variant), `src/ui/authenticated/*` primitives (compact overrides, new
     `AuthenticatedCopyableId`, precise relative time), `data-density` on the admin and demo `<main>`.
   - Account and sign-in visuals must stay unchanged.
2. `done` **Navigation.**
   - Files: `src/ui/production/productionShellNavigationGroups.ts`, the production shell sidebar rendering and the demo
     sidebar in `AdminDemoApp.tsx`.
   - Apply the grouped, always-expanded, compact nav. Keep `Administration` and `Activity` link names.
3. `done` **API additions.**
   - Session list: subject display name and email.
   - Audit events: actor display name.
   - Realm overview: counts.
   - Includes the server feature code, public schemas, client and demo adapter fixtures. No view changes.
4. `done` **Directory pages** (`src/features/directory/ui`): users list, user detail, roles, realm administrators.
5. `done` **Organization pages** (`src/features/organizations/ui`): configuration sections, login policy, organizations
   list and detail.
6. `done` **Projects, machine users, impersonation pages** (`src/features/projects/ui`, `src/features/machineUsers/ui`,
   `src/features/impersonation/ui`).
7. `done` **OIDC pages** (`src/features/oidc/ui`).
8. `done` **Admin feature pages** (`src/features/admin/ui` views): realm overview, sessions, events, activity, sign-in.
   Depends on 1 and 3.
10. `done` **Consistency primitives** (`src/ui/authenticated/`).
    - `AuthenticatedDetailHeader`: one compact card with:
      - an optional back link,
      - an avatar or icon,
      - the title,
      - a muted subtitle,
      - at most 2 status pills,
      - an inline facts row of label/value pairs (`text-xs` label, values that may be a `CopyableId` or
        `RelativeTime`),
      - the primary action plus an overflow menu.
      It replaces the mixed header/facts cards on detail pages.
    - `AuthenticatedSettingsRow`: label and help text on the left, with the control on the right, from `md` up.
    - Compact mobile records (`AuthenticatedRecordItem` / `RecordList`): title row with the status, then one line of
      muted meta. No stacked label per field.
11. `done` **Apply round 2** (per feature, in parallel, after 10):
    - **Directory:** the user detail uses `DetailHeader`. The users list rows render on one line: name, then the
      email muted after it. The mobile list is compact.
    - **Organizations:**
      - Login policy is cleaned up with settings rows. Inherited markers become small inline badges beside the
        label, and lifetime fields sit in an aligned grid.
      - Organization detail uses `DetailHeader` and shows member names and emails instead of UUIDs. A small API
        addition is allowed if needed.
      - Remove the duplicate links.
    - **Projects and machine users:** project detail and machine user detail use `DetailHeader`. Remove the stray
      facts card.
    - **OIDC:**
      - Client detail uses `DetailHeader` and settings rows.
      - Textareas auto-size, with a minimum of 2 rows.
      - Token lifetime inputs show the server default as a placeholder.
      - Compatibility toggles become compact checkbox rows, with the help text inline and muted.
    - **Admin:**
      - Event rows render on one line: the aggregate type, then the copyable ID inline.
      - The payload toggle becomes a chevron icon button.
      - Every demo event gets `actorDisplayName`.
      - The realm overview adds a compact "Recent audit events" table (latest 8, with a link to all) below the
        tiles.
      - Future dates render as "in 3 d".
12. `todo` **Feedback round.**
    - Short time notation everywhere in admin.
    - Users table columns: Display name (avatar + name), Username (mono), Email, Role, Status, Last sign-in (short),
      Created (short).
    - Login policy gets a visible page h1 and compact header.
    - Fix any leftovers from the review.
    - **Consistency sweep.**
      - Every list or settings page starts with a visible `AuthenticatedPageHeader`: an h1, an inline muted count or
        summary, and the primary action on the right. Detail pages use `AuthenticatedDetailHeader`.
      - Row actions are icon buttons (`aria-label` keeps the old text) or an overflow menu.
      - Person and actor names use the sans font, never mono. Mono is only for identifiers.
      - Label sizes are uniform: no `text-base` or `text-lg` labels in forms.
      - Fix the demo fixtures where statuses contradict dates.
9. `todo` **Verification.**
   - `bun run check`.
   - Local e2e for the admin workflows and the landmark sweep.
   - After screenshots.
   - Fix regressions.

Order: tasks 1, 2 and 3 run in parallel, then tasks 4 to 8 in parallel with disjoint file sets, then 10, then 11 (parallel per feature), then 9.

## Working rules for subagents

- Worktree: `/tmp/david/opencode/authworks-admin-redesign.trDl` on branch `feat/admin-ui-redesign`. Work only there.
- **Dev server for visual checks.** Use the shared server at `http://127.0.0.1:5333`. The orchestrator runs it from
  this worktree with HMR. Demo routes are at `/demo/admin/**`. Do not start or stop any server.
- **Screenshots:** `bun /tmp/david/opencode/admin-redesign/shoot.mjs http://127.0.0.1:5333 <outDir>`. Only write
  under `/tmp/david/opencode/`. View the PNGs you produce and judge them against the visual spec.
- **During page tasks:**
  - Run `bun run typecheck`.
  - Run only the unit test files related to the files you touched:
    `bun --conditions=browser test --max-concurrency=1 <file>`.
  - Run `bunx biome check --write <files>` on the files you touched.
  - Do not run the full suite or e2e. That happens in Task 9.
- Update unit tests that assert on changed markup. Do not weaken behavior assertions.
- Do not edit files owned by another task. If you need a shared primitive change, report it instead of making it.
  Exception: if a page needs a small new prop on a primitive, report it as a blocker with the exact proposal.

## Current context

- **Compact primitives.** These are in place: the `compact:` variant, `AuthenticatedCopyableId({ label, value })` and
  precise relative time. Dialogs inherit compact density from their trigger.
- **API.** These are available through the admin adapter:
  - Session items have `subjectDisplayName` and `subjectEmail`.
  - Event items have `actorDisplayName`.
  - `AdminAdapter.sessionList(query)` is the realm-wide list.
  - `AdminAdapter.realmSummaryGet()` returns
    `{ organizations, users, realmAdministrators, oidcClients, activeSessions, auditEvents24h }`.
- **Production navigation.** Groups are still filtered by the selected organization or realm scope, as today. This is
  intended.
- **Shared dev server.** The orchestrator runs it at `http://127.0.0.1:5333` from this worktree, with HMR. Page tasks
  use it and do not start or stop servers.
- **Round 2 primitives.** These are available in `src/ui/authenticated/`:
  - `AuthenticatedDetailHeader`. Props: `title` (required), `backHref?`, `backLabel?`, `leading?`, `subtitle?`,
    `badges?`, `facts?: {label, value}[]`, `actions?`.
  - `AuthenticatedSettingsList` and `AuthenticatedSettingsRow`. Row props: `label` and `children` (required),
    `description?`, `htmlFor?`, `badge?`.
  - `AuthenticatedRecordItem`. New optional props: `compact?` and `meta?: JSX[]`.
