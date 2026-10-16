# Admin UI redesign (login-inspired)

Date: 2026-10-16 · Status: in progress

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
  `src/features/demo/ui`. Account/invitations: inheritance + mechanical control swap only (Task 16).
- Do not touch: login UI (`src/features/{login,passwords,emailOtp,passkeys,mfa}/ui/**` and `.login-*` CSS, except
  the radius pin in Task 1); vendored `ui/**` (synced from solid-ui, read-only — override in `src/ui`);
  `src/ui/i18n/ui/LanguageSelector.tsx` (shared with login — style it via a wrapper class); routes, permissions,
  `*StateCreate`/adapter behaviour, i18n copy; `OidcConsentDemoView.tsx`; `DemoHub.tsx`.
- No new dependencies. Use `@adaptive-ds/mdi` icons and existing vendored components.
- New shared controls render native elements (`<button>`, `<input>`, `<select>`) with complete token class strings.
  Reason: vendored controls hard-code gray/slate/blue palettes plus `dark:`/`hover:` variants, and `classMerge`
  (`cn`) does not treat custom tokens (`rounded-panel`, `rounded-control`, `shadow-panel`, `shadow-overlay`) as
  conflicting with `rounded-md`/`shadow-lg`. Never rely on `classMerge` to override a vendored `rounded-*`/`shadow-*`
  with a custom token. Call-site `class` is appended last via `classMerge` (standard utilities resolve fine).
- Keep the 240px desktop sidebar (`w-60`, asserted by e2e) and logical RTL classes. Both shells switch to drawer mode
  below 1024px (`<Sidebar defaultWidth={1024} …>`), fixing the 768–1023px sidebar/content overlap (content offset is
  `lg:` only).
- No new visible duplicate texts (no breadcrumbs, overview quick links, brand captions): e2e uses unscoped
  text/role queries. Decorative marks are `aria-hidden`.
- Avoid new i18n keys; if one is unavoidable, add it to `englishCatalog.ts` and translate it in all 14
  `public/i18n/*.csv` locales.
- No commits; the user decides later.
- Tailwind theme colors (`--color-*: var(--…)`) resolve at `:root`, so the login's utility-styled bits follow the root
  tokens: its former green leftovers (language icon, last-used method highlight) become blue and borders slightly
  cooler. Accepted — this matches the production login; login radii are pinned.

## Design spec

Targets are binding for structure, tokens and sizes; implementers may fine-tune spacing/opacity by one step for
visual quality, never introduce new colors.

### Tokens — `src/ui/styles.css`

- Light `:root`: background `#f5f7fa`, surface `#ffffff`, muted `#f1f5f9`, surface-hover `#f1f5f9`, foreground
  `#0f172a`, muted-foreground `#5a677d`, border `#e2e8f0`, border-subtle `#edf1f6`, border-strong `#cbd5e1`, accent
  `#2563eb`, accent-hover `#1d4ed8`, accent-contrast `#ffffff`, danger `#b42318`, success/warning unchanged,
  accent-soft `color-mix(in srgb, var(--accent) 8%, var(--surface))`, other soft tints keep their formulas,
  `--panel-shadow: 0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)`,
  `--overlay-shadow: 0 24px 70px rgb(15 23 42 / 0.18)`.
- Dark `:root.dark`: background `#0b1019`, surface `#121a27`, muted `#172031`, surface-hover `#1b2536`, foreground
  `#e6ebf2`, muted-foreground `#98a3b6`, border `#253146`, border-subtle `#1d283a`, border-strong `#35445d`, accent
  `#60a5fa`, accent-hover `#93c5fd`, accent-contrast `#0b1220`, danger `#f97066`, success/warning unchanged,
  accent-soft `color-mix(in srgb, var(--accent) 14%, var(--surface))`, `--panel-shadow: 0 1px 2px rgb(0 0 0 / 0.45)`,
  `--overlay-shadow: 0 24px 70px rgb(0 0 0 / 0.55)`.
- Radii (`@theme`): `--radius-panel: 12px`, `--radius-control: 8px`. Pin the login:
  `.login-page-shell { --radius-panel: 10px; --radius-control: 6px; }`.
- Utilities `shadow-panel` / `shadow-overlay` via `@utility`, composing with Tailwind rings:
  `--tw-shadow: var(--panel-shadow); box-shadow: var(--tw-inset-shadow, 0 0 #0000), var(--tw-inset-ring-shadow,
  0 0 #0000), var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);`
  (same with `--overlay-shadow`).
- `.authenticated-canvas`: `background-color: var(--background)` plus two soft, non-repeating top blooms (accent ≈7%
  near 25% 0, coral `#ff7868` ≈5% at 100% 0); dark: about half the strength.
- `.authenticated-focus-canvas`: the login's 4-bloom wash (primary bloom uses `var(--accent)`) plus a faint dot grid
  (≈22px); dark: weaker blooms, no coral/gold.
- `.authenticated-language-selector` (shells pass it as `class` to `LanguageSelector`, which puts it on the `<label>`
  wrapping icon + select): the label is the pill — height 2rem, padding-inline 0.625rem 0.375rem, gap 0.375rem,
  border `var(--border)` (hover `var(--border-strong)`), radius 9999px, background `var(--surface)`; icon 16px in
  `var(--muted-foreground)`; the select inside is borderless/transparent, padding-inline 0.25rem, font-size
  0.8125rem, no own outline; focus ring on the pill via `:has(select:focus-visible)`. These rules must beat the
  utility classes on the select/icon (unlayered CSS beats `@layer utilities`); verify via computed style.
- Focus: add `textarea:focus-visible` to the global focus rule; add `a:focus-visible` scoped to
  `.authenticated-canvas` and `.authenticated-focus-canvas` with the same outline and `outline-offset: 2px`.
- All text/background pairs keep ≥ 4.5:1 contrast (axe runs in e2e).

### Typography & spacing

System font stack (unchanged). Page title 24px semibold, tight tracking (20px below `sm`). Section title 15px
semibold. Body 14px. Labels/meta 12–13px medium muted, sentence case — no uppercase letter-spaced micro-labels.
Section inset 20px (`px-5`). Page/body gap 20px. Admin content container:
`mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8`.

### Shell (demo and production look identical)

- Sidebar: 240px, surface background, hairline inline-end border. Brand row `h-14` with `AuthenticatedBrandMark`
  (32px `rounded-[10px]` accent square, initial of `app.name`, `aria-hidden`) + app name 15px semibold. Group
  headings: 12px medium muted, sentence case, no icon; 20px between groups. Items: `h-8`, 14px medium, 18px icon
  (`size-4.5`), `rounded-control`. Active: accent-soft background + accent text/icon. Inactive: `text-foreground/80`,
  hover surface-hover.
- Header (content column only, sticky, `h-14`, `bg-surface/80 backdrop-blur-md`, bottom hairline). Start:
  `SidebarToggle`, then brand mark + app name only while the desktop sidebar is not shown
  (`sidebar.isMobile.get() || !sidebar.openDesktop.get()`); production also shows the Administration/Account app links
  as pill links (`aria-current` → accent-soft/accent). End: organization pill select (production), language pill,
  `AuthenticatedThemeToggle` (segmented Light/Dark/System like the login) on wide screens and the vendored
  `ThemeButton` on narrow ones, production user chip (32px accent avatar, name on wide screens) and a round sign-out
  icon button. No overflow at 390, 768, 1024, 1280 and 1440px.
- Shell root uses `.authenticated-canvas`. The impersonation banner sits in the content column above the header.
- Nav/header class strings live in `src/ui/authenticated/authenticatedNavigationClasses.ts`, shared by both shells.

### Primitives (target classes)

- PageHeader: wrapper `grid gap-2 pb-2` (no border); eyebrow `text-xs font-medium text-accent`; h1
  `truncate text-xl font-semibold tracking-tight sm:text-2xl`; description `max-w-3xl text-sm text-muted-foreground`;
  actions `flex flex-wrap items-center gap-2`; meta `flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs
  text-muted-foreground`.
- PageBody: `grid min-w-0 gap-5 [&>*]:min-w-0`.
- Section: root `overflow-hidden rounded-panel border border-line bg-surface shadow-panel`; header bar
  `flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-subtle px-5 py-3.5`; title
  `text-[0.9375rem] font-semibold tracking-tight`; icon in a tile `grid size-7 shrink-0 place-items-center
  rounded-control bg-accent-soft text-accent` (icon `size-4`); description `text-[0.8125rem] text-muted-foreground`;
  actions `gap-2`; padded body `px-5 py-4`.
- Toolbar: `gap-x-3 gap-y-2.5`; summary `text-[0.8125rem] tabular-nums text-muted-foreground`; a search input in a
  toolbar spans the full width on mobile.
- RecordList `divide-y divide-line-subtle md:hidden`; RecordItem `px-5 py-3.5`, title `text-sm font-medium`.
- FieldList: grid `gap-x-6 gap-y-4`; label `text-xs font-medium text-muted-foreground` (sentence case); value
  `mt-1 text-sm` (non-identifier `font-medium`); identifier `truncate font-mono text-[0.8125rem] text-foreground/75`
  with a `title` attribute carrying the full value when it is a string.
- Status pill: `rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5` + 6px dot (tones unchanged).
- Notice: `flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm` with a leading tone icon
  (`mdiAlertCircleOutline` danger, `mdiCheckCircleOutline` success, 18px); keep roles/aria.
- Table classes (`authenticatedTableClasses`): header `bg-muted/70`; head `h-10 px-3 text-start text-xs font-medium
  text-muted-foreground first:ps-5 last:pe-5` (sentence case); cell `px-3 py-3 align-middle first:ps-5 last:pe-5`;
  identifier cell mono `text-[0.8125rem]`; row `border-line-subtle hover:bg-surface-hover/70`; action cell
  `w-0 whitespace-nowrap py-2 ps-2 pe-5 text-end`.

### Controls (`src/ui/authenticated/`)

- `AuthenticatedButton` — drop-in for vendored `ButtonIcon`: same props (`icon`, `iconRight`, `iconClass`,
  `isLoading`, `validationMessage`, `validationVariant`, `validationIcon`, native button props) and the same behaviour
  (click guard while disabled/loading/validating, `aria-disabled`, spinning `mdiLoading`, validation message replaces
  children, `type` defaults to `button`), plus `size?: "sm" | "md"` (default `md`). `variant` accepts only
  `filledBlue | outline | ghost | filledRed | outlineRed` (call sites with other variants, e.g. `card`/`none`, keep the
  vendored component). Native `<button>`; layout `inline-flex items-center justify-center gap-2 rounded-control
  font-medium whitespace-nowrap transition-colors active:scale-[0.98] disabled:pointer-events-none
  disabled:opacity-50`; `md` = `h-9 px-3.5 text-sm`, `sm` = `h-8 px-3 text-[0.8125rem]`, icon-only (no children) =
  square `size-9`/`size-8`; icon `size-4` inheriting the text color. Variants: `filledBlue` = primary (`bg-accent
  text-accent-contrast hover:bg-accent-hover shadow-xs`); `outline` = secondary (`border border-line-strong/70
  bg-surface text-foreground hover:bg-surface-hover shadow-xs`); `ghost` (`text-foreground hover:bg-surface-hover`);
  `filledRed` = danger (`bg-danger text-white hover:bg-danger/90 shadow-xs`, dark text `var(--background)`);
  `outlineRed` = danger outline (`border border-danger/40 bg-surface text-danger hover:bg-danger-soft`). Class
  getters live in their own `.ts` files so `AuthenticatedDialog` triggers reuse them.
- `AuthenticatedInput` (drop-in for vendored `Input`, keeps `dir="auto"`): `h-9 w-full rounded-control border
  border-line-strong/70 bg-surface px-3 text-sm text-foreground shadow-xs placeholder:text-muted-foreground
  focus:border-accent disabled:opacity-50 dark:bg-muted` (the global focus outline stays).
- `AuthenticatedSelect` (drop-in for `SelectSingleNative` with the props its call sites use): same field look,
  `appearance-none pe-9`, muted `mdiChevronDown` at the inline end.
- `authenticatedControlClasses` `{ input, select, textarea, checkbox }` for raw elements (select keeps the native
  arrow; textarea `min-h-24 py-2`; checkbox `size-4 accent-[var(--accent)]`).
- `AuthenticatedThemeToggle` (+ state file): fieldset pill `h-8 rounded-full border border-line bg-surface p-0.5`,
  three 28px round icon buttons (`aria-pressed`, labels `common.theme.light|dark|system`, icons like the login);
  pressed = `bg-accent text-accent-contrast`. Uses the vendored store (`#ui/interactive/theme/themeSignal.js`:
  `themeInit` on mount, `themeSet(theme, true)`), never login internals.
- `AuthenticatedBrandMark`: see Shell.
- Forms in views: `grid gap-4`; field `grid gap-1.5`; label `text-[0.8125rem] font-medium`; help text
  `text-xs text-muted-foreground`; wide forms capped at `max-w-3xl`; short fields `sm:grid-cols-2` where natural.

### Dialogs & states

- Dialog content (own complete class string; keep the vendored positioning/animation behaviour): `rounded-2xl border
  border-line bg-surface p-6 shadow-overlay`, title `text-lg font-semibold tracking-tight`, description `text-sm
  text-muted-foreground`, overlay `bg-slate-950/45 backdrop-blur-[2px]`; footer actions end-aligned, `gap-2`.
  ConfirmDialog matches (keeps `role="alertdialog"`).
- ProductionStatePanel: `rounded-panel border border-line bg-surface shadow-panel`, 44px round icon tile
  (accent-soft/accent; danger-soft/danger for errors), title `text-base font-semibold`, detail
  `text-sm text-muted-foreground`, retry = `AuthenticatedButton` outline.

## Test contracts to preserve

- `e2e/adminDemo.spec.ts` (demo, 1280×720): `main` margin-left 240px ↔ 0px via "Hide sidebar" (demo sidebar footer
  button) and "Open sidebar" (header `SidebarToggle`); navigation landmark "Administration"; every nav link contains an
  SVG; the language label contains an SVG. The demo offset margin must stay on `<main>` itself (its sticky header stays
  inside `<main>`).
- `e2e/adminTask19.spec.ts` (demo, RTL): aside `right: 0px`, `main` margin-right 240px.
- `e2e/productionShells.spec.ts`: production offset margin stays on `main`'s parent; account kind has a static header,
  no aside and the account navigation; admin "Users" link `aria-current="page"`;
  `header select[aria-label="Organization"]`; "Sign out" link containing an SVG.
- `e2e/task19*` sweeps: exactly one `main h1`; axe serious/critical clean at 1440×900 and 390×844; no duplicate named
  landmarks; no horizontal overflow/clipping on mobile.
- `test/ui/accountWorkspace.test.ts` source strings in `ProductionAuthenticatedShell.tsx`: contains
  `state.accountSections()` (before the first `</header>`), `state.isAccountSectionActive(item.id)`,
  `when={props.kind !== "account"}`, `max-w-[1760px]`, `px-4 py-4 sm:px-6`; must not contain `AccountSectionNav`,
  `sticky top-12`, `data-account-toolbar`, `max-w-[1400px]`. Keep the account-section branch even if it looks unused.
- Keep all visible text, accessible names, roles, `data-*` attributes, ids, hrefs and `aria-current` semantics.
- Before editing a file, run `rg -n "<FileBaseName>" test e2e` and keep any source-text assertion satisfied.

## Working rules

- Load the `code-style` skill before writing TS/TSX (one export per file, view-only `.tsx`, `*StateCreate` for
  state). Internal imports use explicit relative `.js` specifiers; vendored imports use `#ui/….jsx|.js`.
- Dev UI server (HMR): `http://127.0.0.1:5180` — never stop it. Port 5174 is a different project — never use it.
- Other agents edit other files concurrently: touch only the files of your task.
- Visual check: load the `agent-browser` skill, use a unique named session (`task<N>`), view your screenshots, close
  the session at the end. Screenshots: before `/tmp/authworks-shots/before/`; after
  `/tmp/authworks-shots/after/task<N>/` (`/tmp/opencode` is not writable). Demo pages need no login.
- Per task run only: `bun run typecheck` (once or twice, not in a loop; ignore errors in files owned by other
  in-progress tasks); `bunx biome check --write <changed files>` (ignore pre-existing lint diagnostics in code you
  did not change, e.g. `role="group"` in `AuthenticatedToolbar`); `bun run check:no-literal-ui-text`; the single unit
  test files named in the task:
  `bun --conditions=browser test --timeout=30000 --isolate --max-concurrency=1 --dots --bail=1 <file>`.
- e2e: never start extra servers (AGENTS.md forbids ad-hoc servers; no vite preview). Only where a task names a spec,
  run it against the running dev server: `AUTHWORKS_E2E_BASE_URL=http://127.0.0.1:5180 bunx playwright test
  e2e/<spec>.spec.ts`. Concurrent HMR edits can cause flakiness — rerun a failing test once before investigating.
  View tasks run no e2e; the full suite and `bun run check` run only in Task 18.
- Temporary files (e.g. screenshot specs under `e2e/`) must be deleted before returning; confirm with `git status`.

## Tasks

Waves (parallel within a wave): W1 = 1–3; W2 = 4, 5, 7; W3 = 6, 8–15; then 17 (+16); then 18.

1. **Tokens & global CSS** — `src/ui/styles.css` only. Status: done
2. **Shared controls** — new `AuthenticatedButton` (+ class getters), `AuthenticatedInput`, `AuthenticatedSelect`,
   `authenticatedControlClasses`, `AuthenticatedThemeToggle` (+ state), `AuthenticatedBrandMark`; adopt the button in
   `AuthenticatedPagination.tsx`. Status: done
3. **Layout/content primitives** — `AuthenticatedPageHeader`, `AuthenticatedPageBody`, `AuthenticatedSection`,
   `AuthenticatedToolbar`, `AuthenticatedRecordList`, `AuthenticatedRecordItem`, `AuthenticatedFieldList`,
   `AuthenticatedStatus`, `AuthenticatedNotice`, `authenticatedTableClasses.ts`. Status: done; follow-up: update
   `test/ui/authenticatedFoundation.test.ts` (asserts old classes, e.g. head `h-8`) — in progress
4. **Dialogs & state panel** — `AuthenticatedDialog.tsx`, `src/ui/confirm/ConfirmDialog.tsx`,
   `src/ui/production/ProductionStatePanel.tsx`. Status: done (e2e `adminTask20Signoff` deferred to Task 18)
5. **Demo admin shell** — `authenticatedNavigationClasses.ts`, `authenticatedNavigationLinkClassGet.ts`,
   `src/features/admin/ui/AdminDemoApp.tsx` (+ `adminDemoAppStateCreate.ts` only if needed). Status: done
6. **Production authenticated shell** (after 5) — `ProductionAuthenticatedShell.tsx`
   (+ `productionAuthenticatedShellStateCreate.ts` only if needed). Status: in progress
7. **Focus shell** — `ProductionFocusShell.tsx` (+ its state file only if needed). Status: done
8. **Admin user views** — `AdminUserListView`, `AdminUserDetailView`, `AdminUserSecurityView`,
   `AdminSessionListView`, other user/session subcomponents, fixture label in `AdminDemoAdapter.tsx`.
   Status: in progress
9. **Admin realm views** — `AdminRealmOverviewView`, `AdminRealmView`, `AdminSignInView`, `AdminEventListView`,
   `AdminScreenView`. Status: in progress
10. **Organization views A** — `OrganizationAdmin{List,Detail,Memberships,Invitations,Screen}View`,
    `OrganizationAdminRoleChooser`, fixture label in `OrganizationAdminDemoAdapter.tsx`. Status: in progress
11. **Organization views B** — `OrganizationAdmin{Domains,Branding,LoginPolicy,SecurityPolicy}View`.
    Status: in progress
12. **Project views** — `src/features/projects/ui/*.tsx` markup + fixture label in `ProjectAdminDemoAdapter.tsx`.
    Status: in progress
13. **OIDC views** — `src/features/oidc/ui/OidcAdmin*.tsx` + fixture label in `OidcAdminDemoAdapter.tsx`.
    Status: in progress
14. **Machine user & impersonation views** — `src/features/machineUsers/ui/MachineAdmin*.tsx`,
    `src/features/impersonation/ui/ImpersonationAdmin*.tsx` + their demo adapters' fixture label.
    Status: in progress
15. **Demo chrome** — `src/features/demo/ui/{DemoFixtureStateSelector,DemoDirectory,DemoDirectoryGroup,
    DemoDirectoryScenarioCard,DemoScenarioPlaceholder}.tsx`. Status: in progress
16. **Account/invitations control swap** (after 17's first pass) — `src/features/account/ui/**`: control swap per the
    view rules and inner-padding alignment with the new section inset; no layout rework. Status: todo
17. **Visual QA & polish** — after-screenshots vs. the before set; fix list → small fix tasks. Status: todo
18. **Final verification** — `bun run check`; full e2e suite against a frozen build; fix failures per spec.
    Status: todo

### View task rules (Tasks 8–14)

- `ButtonIcon`/`Button` → `AuthenticatedButton` (same props/variant); drop pure sizing classes (`h-7`, `h-8`,
  `text-xs`); `size="sm"` for row, record-item, section-header and inline actions.
- `Input` → `AuthenticatedInput`; `SelectSingleNative` → `AuthenticatedSelect`; raw `<select>`, `<input>`,
  `<textarea>` and checkboxes use `authenticatedControlClasses`.
- Uppercase letter-spaced micro-labels → `text-xs font-medium text-muted-foreground` (sentence case).
- Inner content of non-padded sections aligns with the section header inset (`px-3` → `px-5`).
- Truncated identifier cells get a `title` with the full value.
- Apply the form layout rules above. Keep text, aria, roles, `data-*`, ids, behaviour and state files unchanged.

## Current context

- Dev UI: `http://127.0.0.1:5180` (`UI_PORT=5180 bun run dev:ui -- --host 127.0.0.1`, PID 2262422,
  log `/tmp/authworks-vite-ui.log`).
- Before screenshots: `/tmp/authworks-shots/before/` (login, admin light/dark/mobile, account); production login:
  `/tmp/authworks-shots/prod/`.
- Working tree was clean on `main` before this work.
- Implemented control APIs (`src/ui/authenticated/`): `AuthenticatedButton` (vendored `ButtonIcon` props +
  `variant: filledBlue|outline|ghost|filledRed|outlineRed`, default `ghost`; `size: sm|md`, default `md`);
  `authenticatedButtonClassGet(variant?, size?, iconOnly?, ...customClasses)` for non-button triggers;
  `AuthenticatedInput` (native input props, `dir="auto"`); `AuthenticatedSelect` (`getOptions: () => string[]`,
  `valueSignal: SignalObject<string>`, optional `valueText`, `class`, `id`, `disabled`, ARIA attrs — same as
  `SelectSingleNative` call sites); `authenticatedControlClasses.{input,select,textarea,checkbox}`;
  `AuthenticatedThemeToggle` (`class?`); `AuthenticatedBrandMark` (`class?`, merged last).
- Global CSS classes available: `authenticated-canvas`, `authenticated-focus-canvas`,
  `authenticated-language-selector` (pass as `class` to `LanguageSelector`), utilities `shadow-panel`,
  `shadow-overlay`.
- Dialog helpers: `src/ui/authenticated/authenticatedDialogClasses.ts`, `authenticatedDialogTriggerClassGet.ts`.
- `authenticatedNavigationClasses` keys (shared by both shells): `aside`, `contentOffset`, `brandRow`, `brandLink`,
  `footer`, `footerButton`, `frame`, `groupHeading`, `groupSection`, `link`, `linkActive`, `linkInactive`, `nav`,
  `header`, `headerStart`, `headerEnd`, `headerBrand`, `headerBrandMark`, `headerLink`, `sidebarToggle`,
  `mobileContent`, `mobileTitle`, `mobileDescription`, `content` (admin content container). Reference implementation:
  `src/features/admin/ui/AdminDemoApp.tsx`.
- Reported e2e failures under investigation (possibly pre-existing): demo "Administrator session active" expectation;
  `productionShells.spec.ts` sessions endpoint/mock mismatch and account heading/navigation/header expectations.
