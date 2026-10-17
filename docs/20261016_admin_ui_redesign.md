# Admin UI redesign (login-inspired)

Date: 2026-10-16 · Status: done

## Goal

Make the admin UI — production `/admin/**` and fixture demo `/demo/admin/**` — look as polished as the login:
the same blue accent and cool-neutral palette, calm hierarchy, elevated cards, login-style pill controls, consistent
forms/tables/dialogs, a layered dark mode and a clean mobile layout. Account/invitation pages inherit the shared parts
(tokens, primitives, controls) without layout rework. The login stays visually unchanged.

## Decisions

- Accent: blue like the login (light `#2563eb`, dark `#60a5fa`), replacing the green accent of commit `0fc63f8`;
  cool slate neutrals.
- Scope: admin shells + admin views + shared `src/ui/authenticated/*`, `src/ui/confirm/ConfirmDialog.tsx`,
  `src/ui/production/{ProductionAuthenticatedShell,ProductionFocusShell,ProductionStatePanel}.tsx`, demo chrome in
  `src/features/demo/ui`. Account/invitations: control swap + header controls only, no layout rework.
- Not touched: login UI (`src/features/{login,passwords,emailOtp,passkeys,mfa}/ui/**`, `.login-*` CSS except the
  radius pin); vendored `ui/**` (synced from solid-ui, read-only — overrides live in `src/ui`);
  `src/ui/i18n/ui/LanguageSelector.tsx` (styled via a wrapper class); routes, permissions, state/adapter behaviour,
  i18n copy; `OidcConsentDemoView.tsx`; `DemoHub.tsx`.
- No new dependencies and no new i18n keys.
- New shared controls render native elements (`<button>`, `<input>`, `<select>`) with complete token class strings:
  vendored controls hard-code gray/slate/blue palettes plus `dark:`/`hover:` variants, and `classMerge` (`cn`) does
  not treat custom tokens (`rounded-panel`, `rounded-control`, `shadow-panel`, `shadow-overlay`) as conflicting with
  `rounded-md`/`shadow-lg`.
- Genuinely vendored controls stay where the design needs them: `variant="card"`/`"none"` buttons, the account
  identity copy button (`ButtonIconOnly`, test-pinned), the gender `SelectSingle` listbox, organization tabs.
- 240px desktop sidebar (`w-60`) with logical RTL classes; both shells use drawer mode below 1024px
  (`<Sidebar defaultWidth={1024} …>`).
- No new visible duplicate texts (no breadcrumbs, quick links, brand captions); decorative marks are `aria-hidden`.
- Tailwind theme colors resolve at `:root`, so the login's utility-styled bits follow the root tokens: its former
  green leftovers (language icon, last-used method highlight) are blue now, matching the production login.
- Agents never run git write commands; the user handles commits.

## Design spec

### Tokens — `src/ui/styles.css`

- Light `:root`: background `#f5f7fa`, surface `#ffffff`, muted `#f1f5f9`, surface-hover `#f1f5f9`, foreground
  `#0f172a`, muted-foreground `#5a677d`, border `#e2e8f0`, border-subtle `#edf1f6`, border-strong `#cbd5e1`, accent
  `#2563eb`, accent-hover `#1d4ed8`, accent-contrast `#ffffff`, danger `#b42318`, accent-soft 8% accent on surface,
  `--panel-shadow`, `--overlay-shadow`.
- Dark `:root.dark`: background `#0b1019`, surface `#121a27`, muted `#172031`, surface-hover `#1b2536`, foreground
  `#e6ebf2`, muted-foreground `#98a3b6`, border `#253146`, border-subtle `#1d283a`, border-strong `#35445d`, accent
  `#60a5fa`, accent-hover `#93c5fd`, accent-contrast `#0b1220`, danger `#f97066`, accent-soft 14%.
- Radii: `--radius-panel: 12px`, `--radius-control: 8px`; login pinned to 10px/6px via `.login-page-shell`.
- Utilities `shadow-panel` / `shadow-overlay` (compose with Tailwind rings).
- `.authenticated-canvas` (two soft top blooms) on shell roots; `.authenticated-focus-canvas` (login's 4-bloom wash +
  22px dot grid) on the focus shell.
- `.authenticated-language-selector` / `.authenticated-pill-select`: the `<label>` is the pill (2rem, full radius,
  border, surface), borderless select inside, focus ring via `:has(select:focus-visible)`; unlayered rules.
- Focus: global outline for `button`, `input`, `select`, `textarea` (shared with the login, unchanged width/offset);
  `a:focus-visible` scoped to the authenticated canvases.

### Typography & spacing

System font stack. Page title 24px semibold (20px below `sm`); section title 15px semibold; body 14px; labels/meta
12–13px medium muted, sentence case — no uppercase letter-spaced micro-labels. Section inset 20px (`px-5`); page gap
20px; admin content container `mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8`.

### Shell (demo and production identical)

- Sidebar: brand row (`AuthenticatedBrandMark` + app name), group headings 12px muted without icons, 32px items with
  18px icons; active item accent-soft + accent + semibold (dark `bg-accent/20` + `text-accent-hover`). In drawer mode
  the brand row and the demo "Hide sidebar" footer are hidden.
- Header (content column, sticky, 56px, translucent): `SidebarToggle` (panel icon `mdiDockLeft` mirrored in RTL;
  `mdiMenu` in drawer mode), brand while the desktop sidebar is hidden (name ≥ `sm`, kept for screen readers),
  production app links as pills; end: organization pill select / chip, language pill, `AuthenticatedThemeToggle`
  (≥ `sm`) or vendored `ThemeButton` (< `sm`), user chip, round sign-out; demo "Demo" link ≥ `sm`.
- Impersonation banner: full-width warning strip in the content column above the header.
- Account workspace toolbar and the demo account bar use the same pill language selector and theme toggle; the demo
  bar hides its duplicate controls when the workspace toolbar shows them.
- Class strings: `src/ui/authenticated/authenticatedNavigationClasses.ts`.

### Primitives

- PageHeader without divider; eyebrow accent; h1 `text-xl sm:text-2xl`.
- Section: `rounded-panel border bg-surface shadow-panel`, header bar `px-5 py-3.5`, icon in an accent tile, padded
  body `px-5 py-4`.
- Toolbar: mobile search full width, summary + actions on one row below; inline from `sm`.
- FieldList: sentence-case labels, identifiers mono with full-value `title`.
- Status pill with dot; Notice with leading tone icon.
- Tables: `h-10` sentence-case heads, `py-3` cells, `ps-5/pe-5` outer cells, subtle row hover.

### Controls (`src/ui/authenticated/`)

- `AuthenticatedButton`: drop-in for vendored `ButtonIcon` (same props/behaviour) + `size: sm|md`; variants
  `filledBlue` (primary), `outline`, `ghost` (default), `filledRed`, `outlineRed`.
- `AuthenticatedInput`, `AuthenticatedSelect` (same API as `SelectSingleNative` call sites),
  `authenticatedControlClasses.{input,select,textarea,checkbox}` for raw elements.
- `AuthenticatedThemeToggle` (segmented Light/Dark/System, vendored theme store), `AuthenticatedBrandMark`.
- Forms: `grid gap-4`, fields `grid gap-1.5`, labels 13px medium, help text 12px muted, wide forms `max-w-3xl`.

### Dialogs & states

- Dialog: `rounded-2xl border bg-surface p-6 shadow-overlay`, blurred overlay, title wraps by words only; close =
  icon-only ghost `sm` button keeping Corvu's accessible name (`close`) with a translated `title`; footer actions
  end-aligned. `AuthenticatedDialog` has `triggerSize?: "sm" | "md"`. ConfirmDialog matches (`role="alertdialog"`).
- ProductionStatePanel: card with a round icon tile; inside the focus shell no card chrome.
- Focus shell: focus canvas, top-end language pill + theme toggle, centered 470px card (`rounded-[18px]`,
  `shadow-overlay`), brand header, 24px h1; content inside has no own card chrome (`in-[[data-shell=focus]]:`
  variants); admin sign-in submit is full-width `filledBlue`.

## Test contracts to preserve

- `e2e/adminDemo.spec.ts`: demo `main` margin-left 240px ↔ 0px via "Hide sidebar" / "Open sidebar"; navigation
  "Administration"; every nav link and the language label contain an SVG; the demo offset margin is on `<main>`.
- `e2e/adminTask19.spec.ts` (RTL): aside `right: 0px`, `main` margin-right 240px.
- `e2e/productionShells.spec.ts`: production offset margin on `main`'s parent; admin "Users" `aria-current="page"`;
  `header select[aria-label="Organization"]`; "Sign out" link with an SVG.
- `e2e/task19*`: one `main h1`; axe serious/critical clean at 1440×900 and 390×844; no duplicate named landmarks; no
  mobile overflow/clipping.
- `test/ui/accountWorkspace.test.ts` source strings in `ProductionAuthenticatedShell.tsx` (account-section branch,
  `when={props.kind !== "account"}`, `max-w-[1760px]`, `px-4 py-4 sm:px-6`; no `AccountSectionNav`, `sticky top-12`,
  `data-account-toolbar`, `max-w-[1400px]`).
- Keep visible text, accessible names, roles, `data-*`, ids, hrefs and `aria-current` semantics.

## Working rules

- Load the `code-style` skill for TS/TSX; explicit relative `.js` imports; vendored imports via `#ui/…`.
- Solid: never read a JSX prop (`props.actions`, `props.children`, …) in a condition and render it again — resolve it
  once with `children(() => props.x)` or `<Show when={props.x}>{(x) => x()}</Show>`.
- Destructive triggers in views use `outlineRed` (`size="sm"` in rows, record items, section headers); only final
  confirmations are `filledRed`. Dialog form actions end-aligned, no full-width submit buttons.
- Checks per change: `bun run typecheck`, `bunx biome check --write <files>`, `bun run check:no-literal-ui-text`,
  single unit files with `bun --conditions=browser test --timeout=30000 --isolate --max-concurrency=1 --dots
  --bail=1 <file>`; e2e only for named specs:
  `AUTHWORKS_E2E_BASE_URL=http://127.0.0.1:5180 bunx playwright test e2e/<spec>.spec.ts`.

## Tasks

1. Tokens & global CSS. Status: done
2. Shared controls (button, input, select, control classes, theme toggle, brand mark, pagination). Status: done
3. Layout/content primitives. Status: done
4. Dialogs, ConfirmDialog, state panel. Status: done
5. Demo admin shell. Status: done
6. Production authenticated shell. Status: done
7. Focus shell. Status: done
8. Admin user and session views. Status: done
9. Admin realm, sign-in and event views. Status: done
10. Organization list/detail/memberships/invitations. Status: done
11. Organization domains/branding/login policy/security policy. Status: done
12. Project views. Status: done
13. OIDC views. Status: done
14. Machine user and impersonation views. Status: done
15. Demo chrome. Status: done
16. Account/invitations control swap. Status: done
17. Visual QA & polish (shell, focus shell, primitives, consistency sweep, JSX-prop evaluation fix, alias cleanup,
    OIDC/machine/org polish, destructive triggers, account header controls). Status: done
18. Final verification (`bun run check`, full e2e suite, failure classification). Status: done

## Current context

- Dev UI: `http://127.0.0.1:5180` (`UI_PORT=5180 bun run dev:ui -- --host 127.0.0.1`; port 5174 belongs to another
  project on this machine).
- Screenshots: before `/tmp/authworks-shots/before/`, final `/tmp/authworks-shots/final/`, production login
  `/tmp/authworks-shots/prod/`.
- Reference shell: `src/features/admin/ui/AdminDemoApp.tsx`.
