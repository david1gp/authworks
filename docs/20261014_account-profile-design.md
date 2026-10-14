# Account page profile redesign

## Goal

Make `/account` look cleaner and more colorful:

- The "Sign-in details" disclosure (header + collapse/expand) is removed. Profile identity data is always shown.
- Display name, username, email and phone are shown compactly. Display name, email and phone use icons; their text labels
  move into `title`/`aria-label` attributes. No `|` vertical dividers (`sm:divide-x`) and no `border-y` rules between fields.
- The circular initial badge ("D") next to the sign-out button in the account toolbar is removed.
- Icons are green, consistently across the whole UI (not gray).

## Decisions

- Green is introduced by changing the authenticated theme `--accent` tokens in `src/ui/styles.css` (light + dark), so icons,
  buttons, links and focus rings share one green. Login pages keep their own `--brand-primary` mapping (`.login-page-shell`).
  - Light: `--accent: #047857`, `--accent-hover: #065f46`, `--accent-contrast: #ffffff`.
  - Dark: `--accent: #34d399`, `--accent-hover: #6ee7b7`, `--accent-contrast: #052e1f`.
  - `--status-action-blue` stays as-is (semantic status color).
- Icons use `text-accent` instead of `text-muted-foreground`. Text labels/meta stay muted; only `<Icon>` color changes.
- Status-tone icons (`text-danger`, `text-success`, `text-warning`) keep their tone colors.
- Use existing libraries only (`@adaptive-ds/mdi` icons, Tailwind 4 utilities, existing `Icon`, `AccountIdentityCopyButton`,
  `AccountProfilePictureField`, `AccountSecurityProgress`). No new dependencies.

## Key files

- `src/features/account/ui/AccountProfileIdentityStrip.tsx` — profile identity card (currently a "Sign-in details" disclosure).
- `src/features/account/ui/AccountWorkspaceToolbar.tsx` — language/theme/initial badge/sign-out toolbar on `/account`.
- `src/features/account/ui/AccountDisclosure.tsx` — shared disclosure (keep; only icon colors change).
- `src/ui/styles.css` — theme tokens.
- `ui/static/icon/Icon.tsx` — shared icon (`fill-current`; color via `class`).
- Demo preview: `env UI_PORT=5174 bunx vite --host 127.0.0.1` → `http://127.0.0.1:5174/demo/account/profile`.

## Target profile card layout (`AccountProfileIdentityStrip.tsx`)

A plain always-visible card (`rounded-panel border border-line bg-surface`, compact padding `p-4 sm:p-5`), no `<details>`,
no "Sign-in details" heading:

- Left: `AccountProfilePictureField` (avatar). Right of it (stacked, `min-w-0`):
  - Display name as the prominent title (`text-lg font-semibold`), with a small green `mdiAccountOutline` icon whose
    `title`/`aria-label` is the "Display name" label; copy button when set. Falls back to muted "Not set".
  - Username directly below as muted mono `text-sm` text (prefixed `@`), with copy button. Label in `title`.
  - A compact wrapping row (`flex flex-wrap gap-x-5 gap-y-2`) of contact items:
    - Email: green `mdiEmailOutline` icon (label "Email address" in title/aria-label), mono email text, copy button, small
      verification indicator (`mdiCheckDecagram` `text-success` when verified; `mdiClockOutline` `text-warning` when pending;
      title = existing verified/pending message).
    - Phone: green `mdiPhoneOutline` icon (label "Phone number" in title/aria-label), number or muted "Not set", same
      verification indicator when set.
- Mobile (390px): no horizontal overflow; long emails `break-all`.
- `AccountSecurityProgress` (if provided) stays below, separated by spacing only (`mt-4`), no border rule.

## Tasks

1. **Green theme + icon colors** — accent tokens in `src/ui/styles.css`; replace `text-muted-foreground` with `text-accent` on
   `<Icon>` elements across `src/` and `ui/`. Do not touch `AccountProfileIdentityStrip.tsx` or
   `AccountWorkspaceToolbar.tsx`. Status: done
2. **Profile card + toolbar badge** — rewrite `AccountProfileIdentityStrip.tsx` per layout above; remove initial badge from
   `AccountWorkspaceToolbar.tsx` (sign-out icon green `text-accent`). Update tests referencing "Sign-in details" or the badge.
   Status: done (incl. polish: compact green copy buttons, smaller mobile avatar, sans email/phone, green ThemeButton)
3. **Verify, commit, deploy** — `bun run check`, targeted e2e, `/commits` skill, `prodctl deploy`, production browser check.
   Status: done (deployed 0fc63f8)

## Verification rules

- Tasks 1–2: typecheck + Biome on changed files + directly affected unit tests (`bun test --max-concurrency=1 <file>`) +
  visual check of the demo page. Do not run the full e2e suite.
- Task 3: `bun run check` and only `e2e/accountProfilePages.spec.ts`, `e2e/productionShells.spec.ts`.
- Production login for browser checks: credentials are in repo `.env` as `AUTHWORKS_SSOTEST_USERNAME` /
  `AUTHWORKS_SSOTEST_PASSWORD` (password login at `/login/password?return_to=%2Faccount`).
