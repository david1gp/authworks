# Account page card redesign

## Goal

Every `/account` card leads with a large bare icon. A small status badge overlaps the icon's bottom-right corner: a
green check when the item is configured or verified, a red alert when it is not. The Profile section is compact on
wide desktop screens. The MFA overview is subtle and dense, and the profile picture sits on the right of the identity
card.

## Context

- Worktree: `/tmp/authworks-account-cards.m1tIgz/authworks`, branch `feat/account-card-redesign`. Never touch
  `/home/david/adaptive/authworks`.
- Stack: SolidJS, Tailwind v4 (tokens in `src/ui/styles.css`), and MDI icons from `@adaptive-ds/mdi` rendered with
  `#ui/static/icon/Icon.jsx` (resolves to `ui/static/icon/Icon.tsx`). Use only existing dependencies.
- All visible text comes from `messageTranslate(...)` catalog keys. `bun run check:no-literal-ui-text` enforces this.
  - English lives in `src/ui/i18n/model/englishCatalog.ts`.
  - Other locales live in `public/i18n/*.csv` and are loaded at runtime; there is no codegen.
- Every card goes through `src/features/account/ui/AccountDisclosure.tsx` (`variant="card"`). Its icon and badge are
  rendered by `AccountCardIcon.tsx`.
- Profile identity card:
  - `AccountProfileIdentityStrip.tsx` renders the picture, name, handle, contacts, and `AccountSecurityProgress`
    (the MFA overview).
  - `AccountProfileView.tsx` (`kind="overview"`) renders the strip, then one row with Personal information, Email
    addresses, and Phone numbers.
- Demo pages that need no login:
  - `/demo/account` mirrors `/account`.
  - `/demo/account/overview?state=empty` shows the not-configured security states.
- Screenshots:
  - Before: `/tmp/authworks-account-cards.m1tIgz/screens/before/`
  - First iteration: `/tmp/authworks-account-cards.m1tIgz/screens/after/`
  - Second iteration: `/tmp/authworks-account-cards.m1tIgz/screens/v2/`

## Decisions

- **Card icon:** bare and larger, with no tile background.
  - Subject icon: `size-8 sm:size-9 text-accent`. With `iconTone="danger"` (Danger zone card) it is `text-danger`.
  - The wrapper is `relative inline-flex shrink-0` and only exists to position the badge.
- **Status badge:** overlaps the icon's bottom-right corner (`absolute -right-1 -bottom-1`).
  - Glyph: filled `mdiCheckCircle` in `text-success` or `mdiAlertCircle` in `text-danger`, sized about `size-4.5`.
  - It sits on a `rounded-full bg-surface ring-2 ring-surface` backing. On summary hover it switches to
    `bg-surface-hover` / `ring-surface-hover` via `group-hover/summary`. Mark it `aria-hidden`.
  - Mapping from `statusTone`: `success` → check, `danger` → alert, `neutral`/none → no badge.
  - With `iconTone="danger"` there is no badge.
- **Status text:** a small pill next to the title (`rounded-full px-2 py-0.5 text-2xs font-medium`).
  - `success`: `bg-success-soft text-success`
  - `danger`: `bg-danger-soft text-danger`
  - `neutral`: `bg-muted text-muted-foreground`
- **Not-configured security cards:** password, passkeys, linked identities, and recovery codes use
  `statusTone: "danger"`. They render only after data has loaded, so no red badge flashes while loading.
- **MFA overview label:** `Multi-factor authentication (MFA)`.
  - Keep the key `account.security.recoveryMfa`, and update English and all 15 locale CSVs with proper translations.
- **MFA overview layout:** subtle and dense. There is no bordered box.
  - The summary is a single line: shield icon `size-4`, label `text-xs font-medium` or `text-sm font-medium`, a thin
    progress bar (`h-1.5 flex-1`), the count text in `text-xs text-muted-foreground tabular-nums`, and a small chevron.
  - It is still a `<details>`. The expanded list uses compact rows (`py-1.5`, small text) and may use 2 columns on
    wide screens.
  - Keep `role="progressbar"` and its aria attributes, the `href={item.href}` row links, and the
    `messageTranslate("account.security.recoveryMfa")` call.
- **Identity card layout:**
  - Left column (`min-w-0 flex-1`): name, handle, email/phone, then the compact MFA row across the full left width.
  - Right: the profile picture (`shrink-0`, right-aligned).
  - The old separate right-hand MFA column and its divider are gone.
  - On small screens the picture stays top-right next to name, handle, and contacts. The MFA row may span the full card
    width below them.
  - The picture field's upload/remove controls must not overflow at the right edge.
- **Profile row:** `lg:grid-cols-2 xl:grid-cols-3`.
  - Personal information is `lg:col-span-2 xl:col-span-1`.
  - The personal-information `<dl>` is `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2`.
  - No `h-full`, so opening one card doesn't stretch its siblings.
- **Layout widths are unchanged:** `AccountWorkspace` keeps `max-w-7xl`, and the security grid keeps
  `md:grid-cols-2 xl:grid-cols-3`.

## Tasks

1. **Card header, icon tile, badge, and pill.** Status: done (committed).
2. **Not-configured security tone → `danger`.** Status: done (committed).
3. **Profile section layout.** Status: done (committed).
   - Single `kind="overview"` profile adapter.
   - Personal info, email, and phone share one row.
4. **First visual verification.** Status: done.
5. **Full gate and first commits.** Status: done. 5 local commits.
6. **Bare, bigger card icons without a tile background.** Status: done (uncommitted).
   - Owns `AccountCardIcon.tsx`, `AccountDisclosure.tsx` (only if the summary spacing needs adjusting), and the
     card-icon assertions in `test/ui/accountWorkspace.test.ts`.
7. **MFA label, compact MFA overview, picture on the right.** Done sequentially in three parts:
   - 7a: label in English and all 14 locale CSVs. Status: done (uncommitted).
   - 7b: compact `AccountSecurityProgress.tsx`, plus the progress assertions in
     `test/ui/accountSecurityManagement.test.ts` and `test/ui/accountWorkspace.test.ts`. Status: done.
   - 7c: `AccountProfileIdentityStrip.tsx` with the picture on the right and the MFA row under the contacts, plus the
     strip assertions in `test/ui/accountWorkspace.test.ts`. Status: done.
   - 7d: mobile fix. At 390px the MFA label truncates to nothing. Status: done.
     - Strip: switch to a CSS grid `grid-cols-[minmax(0,1fr)_auto]`. On mobile the MFA row spans both columns below the
       picture; from `sm` up it stays in column 1 and the picture spans both rows.
     - Summary below `sm`: line 1 is shield + label + chevron, line 2 is bar + count. From `sm` up it stays one line.
8. **v2 screenshots, targeted gate, and commit.** Status: done.
9. **Consistent authenticator status.** Status: done.
   - The authenticator card uses the shared `account.status.configured` / `account.status.notConfigured` keys.
   - The old `account.factors.configured` / `account.factors.missing` catalog keys are still present but unused.
10. **Merge into `main` and push.** Status: in progress.

## Testing rules

- Implementation tasks run only the affected test files:
  `bun test --conditions=browser <files> --max-concurrency=1`
- Also run `bunx tsc --noEmit -p .`, Biome on the changed files, and `bun run check:no-literal-ui-text`.
- When two tasks run in parallel and share `test/ui/accountWorkspace.test.ts`, make only targeted edits. Never run a
  formatter with `--write` on that file.
- Do not run e2e for these visual changes.
- Known environment noise (also present at base):
  - `bun` prints `Cannot read file "/tmp/": EACCES` under `/tmp`.
  - `bun build`, some CLI tests, `format:check` on README and `ui/AGENTS.md`, and 6 account e2e specs fail.

## Current context

- Tasks 1–9 are committed on `feat/account-card-redesign`.
- Comparison screenshots: `/tmp/authworks-account-screens.9wxM4P/` (`0-original`, `1-previous`, `2-current`).
- Next: integrate with the current `main` and push to `origin/main`.
