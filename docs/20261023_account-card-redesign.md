# Account page card redesign

## Goal

Redesign the `/account` cards so each card leads with a larger icon tile. A status badge overlaps the tile's bottom-right
corner: a green check when the item is configured or verified, a red alert when it is not. Also make the Profile section
compact so it no longer leaves a wide empty area on the right on wide desktop screens.

## Context

- Worktree: `/tmp/authworks-account-cards.m1tIgz/authworks`, branch `feat/account-card-redesign`. Never touch
  `/home/david/adaptive/authworks`.
- Stack: SolidJS, Tailwind v4 (tokens in `src/ui/styles.css`), and MDI icons from `@adaptive-ds/mdi` rendered with
  `#ui/static/icon/Icon.jsx` (resolves to `ui/static/icon/Icon.tsx`). Use only existing dependencies.
- All visible text must come from `messageTranslate(...)` catalog keys. `bun run check:no-literal-ui-text` enforces this.
- Every card goes through `src/features/account/ui/AccountDisclosure.tsx` with `variant="card"`. That covers 14 callers
  across profile, security, devices-applications, access, and danger-zone.
- Demo without login: `/demo/account` mirrors `/account` through `AccountWorkspaceDemoAdapter.tsx`. The production
  version is `AccountWorkspaceProductionAdapter.tsx`. Both compose the profile section as
  `kind="overview"` + `kind="email"` adapters.
- `/demo/account/overview?state=empty` shows the not-configured security states.

## Decisions

- Card icon tile: `relative` rounded square (`size-11 sm:size-12 rounded-xl bg-accent-soft text-accent`) with the
  subject icon at `size-6 sm:size-7`. It replaces the current bare `size-5` icon.
- Status badge: absolutely positioned at the tile's bottom-right (about `-right-1.5 -bottom-1.5`). It is a filled MDI
  circle icon (`mdiCheckCircle` in `text-success`, `mdiAlertCircle` in `text-danger`, `size-5`) on a
  `rounded-full bg-surface` backing with a `ring-2 ring-surface` cut-out, so it reads as an overlay. Mark it
  `aria-hidden`; the status text stays visible.
- The badge comes from `statusTone`: `success` → check, `danger` → alert, `neutral`/none → no badge.
- Danger zone card (`AccountDeleteView`): a new optional `iconTone="danger"` prop turns the tile red
  (`bg-danger-soft text-danger`) and shows no badge.
- Status text stays as a small pill next to the title: `rounded-full px-2 py-0.5 text-2xs font-medium`.
  - `success`: `bg-success-soft text-success`
  - `danger`: `bg-danger-soft text-danger`
  - `neutral`: `bg-muted text-muted-foreground`
- The inline `statusIcon` is dropped (the prop and its callers), because the badge replaces it.
- Header sizing is scaled up to match the larger tile (taller min height, `gap-4`, slightly larger title and value
  text). The chevron behavior stays the same.
- Security cards that are not configured (password, passkeys, linked identities, recovery codes) use
  `statusTone: "danger"`, so they get the red alert badge. The authenticator card already does this.
- Profile identity card: from `lg` up, a 2-column grid with avatar, name, handle, and contacts on the left and the
  Recovery access / MFA progress panel on the right. Below `lg` it stacks as it does today.
- Personal information, Email addresses, and Phone numbers share one row from `lg` up (`lg:grid-cols-3`, cards
  `h-full`) and stack below `lg`. The personal-information `<dl>` inside its now-narrower card must not use
  `lg:grid-cols-3`.
- Layout widths are unchanged: `AccountWorkspace` keeps `max-w-7xl`, and the security grid keeps
  `md:grid-cols-2 xl:grid-cols-3`.

## Tasks

1. **Card header + icon tile + badge + pill.** Status: done.
   - New component `src/features/account/ui/AccountCardIcon.tsx`, one export.
   - Use it in `AccountDisclosure` (card variant), add `iconTone`, remove `statusIcon`, and update callers and tests.
2. **Not-configured security tone → `danger`.** Status: done.
   - Applies to the state-create files for password, passkeys, identities, and recovery codes, plus their tests.
3. **Profile section layout.** Status: done, including the 3c polish. Split into two parallel parts with separate file
   ownership:
   - 3a: identity strip 2-column layout at `lg`, with the progress panel on the right. Owns
     `AccountProfileIdentityStrip.tsx` and `AccountSecurityProgress.tsx`.
   - 3b: personal info, email, and phone in one `lg:grid-cols-3` row. Owns `AccountProfileView.tsx` and the workspace
     adapters (production + demo). Move the contact cards into the overview composition without duplicating dialogs
     or confirmations. Standalone `/demo/account/profile` and `/demo/account/email` keep working.
   - Both may make small, targeted edits to `test/ui/accountWorkspace.test.ts`.
   - 3c polish:
     - Profile row: `lg:grid-cols-2 xl:grid-cols-3`, with personal info `lg:col-span-2 xl:col-span-1`.
     - Personal-info `<dl>` in the workspace: `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2`.
     - Remove `h-full` from the personal-info, email, and phone cards, so opening one card doesn't stretch its
       siblings.
     - Identity strip: switch to `xl:grid-cols-2` (equal halves) so the progress panel balances the card on wide
       screens.
4. **Visual verification.** Status: done.
   - Screenshots at 1920 / 1440 / 390, light and dark, plus `/demo/account/overview?state=empty`.
   - Save them to `/tmp/authworks-account-cards.m1tIgz/screens/after/`.
5. **Full gate + commit.** Status: gate verified (only failures that also occur at base). Commit pending.
   - Run `bun run check` and the local account e2e specs (`e2e/accountDemo.spec.ts`, `e2e/accountProfilePages.spec.ts`).
   - Commit locally with conventional commits. Do not push.

## Testing rules

- During tasks 1–3 run only the affected test files:
  `bun test --conditions=browser <files> --max-concurrency=1`
- Also run `bunx tsc --noEmit` (or the repo typecheck script) and Biome on the changed files.
- Do not run `bun run check`, the full suite, or e2e until task 5.

## Current context

- Tasks 1–4 are done. The task 5 gate has been run; the commits are next.
- Gate notes:
  - Remaining failures also occur at base: `format:check` on README and `ui/AGENTS.md`, `/tmp`-induced CLI and build
    failures, and 6 account e2e specs.
  - `test/ui/accountAccessProductionStateCreate.test.ts` gained a `/me/emails` mock.
- Task 3 is done and uncommitted:
  - The workspace mounts a single `kind="overview"` profile adapter.
  - The `renderConfirmation` prop was removed.
  - The overview now loads the email list.
- Tasks 1–2 are done and uncommitted. Targeted tests pass (105/105) and so does tsc.
- Security cards render only inside `AccountStateBoundary` once the state is ready, so the danger tone can't flash
  while loading.
- Tasks 1–2 also changed:
  - `test/ui/accountWorkspace.test.ts`: added `useNavigate` to its router mock.
  - `accountWorkspaceIdentityPicture.test.ts`: fixed its happy-dom globals.
- `bun run` prints `Cannot read file "/tmp/": EACCES` for scripts run under `/tmp`. This is environmental and harmless
  (exit code 0).
- Baseline screenshots: `/tmp/authworks-account-cards.m1tIgz/screens/before/`.
