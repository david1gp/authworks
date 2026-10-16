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
- Agents never run `git commit`, `push`, `stash`, `reset`, `checkout`, `restore` or `revert`; the user handles git.
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
- Radii (`@theme`): `--radius-panel: 12px`, `--radius-control: 8px`. Login pin:
  `.login-page-shell { --radius-panel: 10px; --radius-control: 6px; }`.
- Utilities `shadow-panel` / `shadow-overlay` via `@utility`, composing with Tailwind rings (`--tw-shadow` +
  inset/ring shadow chain).
- `.authenticated-canvas`: `background-color: var(--background)` plus two soft, non-repeating top blooms (accent ≈7%
  near 25% 0, coral `#ff7868` ≈5% at 100% 0); dark: about half the strength.
- `.authenticated-focus-canvas`: the login's 4-bloom wash (primary bloom uses `var(--accent)`) plus a faint 22px dot
  grid; dark: weaker blue blooms only.
- `.authenticated-language-selector` / `.authenticated-pill-select` (class on the `<label>` wrapping icon + select):
  the label is the pill — height 2rem, border `var(--border)` (hover `var(--border-strong)`), radius 9999px,
  background `var(--surface)`; 16px muted icon; borderless transparent select, 0.8125rem; focus ring on the pill via
  `:has(select:focus-visible)`. Unlayered rules so they beat the utility classes inside `LanguageSelector`.
- Focus: global focus rule covers `button`, `input`, `select`, `textarea`; `a:focus-visible` scoped to
  `.authenticated-canvas` / `.authenticated-focus-canvas` with `outline-offset: 2px`. The global outline is shared with
  the login — leave its width/offset unchanged.
- All text/background pairs keep ≥ 4.5:1 contrast (axe runs in e2e).

### Typography & spacing

System font stack (unchanged). Page title 24px semibold, tight tracking (20px below `sm`). Section title 15px
semibold. Body 14px. Labels/meta 12–13px medium muted, sentence case — no uppercase letter-spaced micro-labels.
Section inset 20px (`px-5`). Page/body gap 20px. Admin content container:
`mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8`.

### Shell (demo and production look identical)

- Sidebar: 240px, surface background, hairline inline-end border. Brand row `h-14` with `AuthenticatedBrandMark`
  + app name 15px semibold. Group headings: 12px medium muted, sentence case, no icon; 20px between groups. Items:
  `h-8`, 14px medium, 18px icon, `rounded-control`. Active: accent-soft background + accent text/icon, `font-semibold`
  (dark: `bg-accent/20` + `text-accent-hover`). Inactive: `text-foreground/80`, hover surface-hover.
- Inside the mobile drawer (< 1024px) the sidebar brand row and the demo "Hide sidebar" footer are hidden (the drawer
  has its own title and close button).
- Header (content column only, sticky, `h-14`, `bg-surface/80 backdrop-blur-md`, bottom hairline). Start:
  `SidebarToggle` with an 18px icon — panel icon (`mdiDockLeft`, fallback `mdiPageLayoutSidebarLeft`, mirrored in RTL)
  in desktop mode, `mdiMenu` in drawer mode — then brand mark + app name while the desktop sidebar is not shown (the
  name visible ≥ `sm` only, kept for screen readers); production also shows the Administration/Account app links as
  pill links (`aria-current` → accent-soft/accent). End: organization pill select (production), language pill,
  `AuthenticatedThemeToggle` ≥ `sm` / vendored `ThemeButton` < `sm`, production user chip (32px accent avatar, name
  ≥ `md`) and a round sign-out icon button; demo: "Demo" link ≥ `sm` only. No overflow at 390, 768, 1024, 1280 and
  1440px.
- Shell root uses `.authenticated-canvas`. The impersonation banner sits in the content column above the header.
- Nav/header class strings live in `src/ui/authenticated/authenticatedNavigationClasses.ts`, shared by both shells.
- `AuthenticatedBrandMark`: accent square, initial of `app.name`, `aria-hidden`, bold `leading-none` text; radius
  proportional to size (32px → 10px, 28px → 9px).

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
- Toolbar: `gap-x-3 gap-y-2.5`; summary `text-[0.8125rem] tabular-nums text-muted-foreground`; on mobile the search
  spans the full width and summary + actions share one row (`justify-between`).
- RecordList `divide-y divide-line-subtle md:hidden`; RecordItem `px-5 py-3.5`, title `text-sm font-medium`.
- FieldList: grid `gap-x-6 gap-y-4`; label `text-xs font-medium text-muted-foreground` (sentence case); value
  `mt-1 text-sm` (non-identifier `font-medium`); identifier `truncate font-mono text-[0.8125rem] text-foreground/75`
  with a `title` carrying the full value when it is a string.
- Status pill: `rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5` + 6px dot (tones unchanged).
- Notice: `flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm` with a leading tone icon
  (18px, `aria-hidden`); keep roles/aria.
- Table classes (`authenticatedTableClasses`): header `bg-muted/70`; head `h-10 px-3 text-start text-xs font-medium
  text-muted-foreground first:ps-5 last:pe-5` (sentence case); cell `px-3 py-3 align-middle first:ps-5 last:pe-5`;
  identifier cell mono `text-[0.8125rem]`; row `border-line-subtle hover:bg-surface-hover/70`; action cell
  `w-0 whitespace-nowrap py-2 ps-2 pe-5 text-end`.

### Controls (`src/ui/authenticated/`)

- `AuthenticatedButton` — drop-in for vendored `ButtonIcon` (same props and behaviour: click guard while
  disabled/loading/validating, `aria-disabled`, spinning `mdiLoading`, validation message replaces children,
  `iconRight` hidden while loading/validating, `type` defaults to `button`) plus `size?: "sm" | "md"`. `variant`:
  `filledBlue` (primary) | `outline` (secondary) | `ghost` (default) | `filledRed` (danger) | `outlineRed`. Call sites
  with other variants (e.g. `card`, `none`) keep the vendored component. Native `<button>`, `rounded-control`,
  `md` = `h-9 px-3.5 text-sm`, `sm` = `h-8 px-3 text-[0.8125rem]`, icon-only = square; icon `size-4`.
- `AuthenticatedInput` (drop-in for vendored `Input`, `dir="auto"`), `AuthenticatedSelect` (drop-in for
  `SelectSingleNative`), `authenticatedControlClasses.{input,select,textarea,checkbox}` for raw elements.
- `AuthenticatedThemeToggle`: segmented Light/Dark/System pill like the login; vendored theme store.
- Forms in views: `grid gap-4`; field `grid gap-1.5`; label `text-[0.8125rem] font-medium`; help text
  `text-xs text-muted-foreground`; wide forms capped at `max-w-3xl`; short fields `sm:grid-cols-2` where natural.

### Dialogs & states

- Dialog content: `rounded-2xl border border-line bg-surface p-6 shadow-overlay`, title `text-lg font-semibold
  tracking-tight`, description `text-sm text-muted-foreground`, overlay `bg-slate-950/45 backdrop-blur-[2px]`; close
  control = icon-only ghost `sm` button (accessible name unchanged via `aria-label` + `title`); footer actions
  end-aligned, `gap-2`. ConfirmDialog matches (keeps `role="alertdialog"`).
- ProductionStatePanel: `rounded-panel border border-line bg-surface shadow-panel`, 44px round icon tile
  (accent-soft/accent; danger-soft/danger for errors), title `text-base font-semibold`, detail
  `text-sm text-muted-foreground`, retry = `AuthenticatedButton` outline. Inside the focus shell it drops its card
  chrome (no card-in-card).
- Focus shell: `.authenticated-focus-canvas`, top-end language pill + theme toggle (≥ `sm`; `ThemeButton` below),
  centered 470px card `rounded-[18px] border-line bg-surface shadow-overlay`, brand header, 24px h1. Content rendered
  inside it (e.g. admin sign-in) has no own card chrome; the sign-in submit is a full-width `filledBlue` button.

## Test contracts to preserve

- `e2e/adminDemo.spec.ts` (demo, 1280×720): `main` margin-left 240px ↔ 0px via "Hide sidebar" (demo sidebar footer
  button) and "Open sidebar" (header `SidebarToggle`); navigation landmark "Administration"; every nav link contains an
  SVG; the language label contains an SVG. The demo offset margin stays on `<main>` itself (its sticky header stays
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
- Other agents edit other files concurrently: touch only the files of your task. No git write commands.
- Visual check: load the `agent-browser` skill, use a unique named session (`task<N>`), view your screenshots, close
  the session at the end. Screenshots: before `/tmp/authworks-shots/before/`; after
  `/tmp/authworks-shots/after/task<N>/` (`/tmp/opencode` is not writable). Demo pages need no login.
- Per task run only: `bun run typecheck` (once or twice; ignore errors in files owned by other in-progress tasks);
  `bunx biome check --write <changed files>` (ignore pre-existing diagnostics in code you did not change);
  `bun run check:no-literal-ui-text`; the single unit test files named in the task:
  `bun --conditions=browser test --timeout=30000 --isolate --max-concurrency=1 --dots --bail=1 <file>`.
- e2e: never start extra servers (AGENTS.md forbids ad-hoc servers). Only where a task names a spec, run it against
  the dev server: `AUTHWORKS_E2E_BASE_URL=http://127.0.0.1:5180 bunx playwright test e2e/<spec>.spec.ts`. Rerun a
  failing test once before investigating (concurrent HMR edits). The full suite and `bun run check` run only in
  Task 18.
- Temporary files (e.g. screenshot specs under `e2e/`) must be deleted before returning; confirm with `git status`.

## Tasks

Order: 1–17, 18a, 18b, 18d–18f done → 18g OIDC diagnosis + 18c check (parallel) → 18h final full e2e run.

1. **Tokens & global CSS** — `src/ui/styles.css`. Status: done
2. **Shared controls** — `AuthenticatedButton` (+ class getters), `AuthenticatedInput`, `AuthenticatedSelect`,
   `authenticatedControlClasses`, `AuthenticatedThemeToggle` (+ state), `AuthenticatedBrandMark`, pagination.
   Status: done
3. **Layout/content primitives** — `AuthenticatedPageHeader`, `…PageBody`, `…Section`, `…Toolbar`, `…RecordList`,
   `…RecordItem`, `…FieldList`, `…Status`, `…Notice`, `authenticatedTableClasses.ts`; test
   `authenticatedFoundation.test.ts` updated. Status: done
4. **Dialogs & state panel** — `AuthenticatedDialog.tsx`, `ConfirmDialog.tsx`, `ProductionStatePanel.tsx`.
   Status: done
5. **Demo admin shell** — `authenticatedNavigationClasses.ts`, `AdminDemoApp.tsx` (+ state). Status: done
6. **Production authenticated shell** — `ProductionAuthenticatedShell.tsx` (+ state). Status: done
7. **Focus shell** — `ProductionFocusShell.tsx`. Status: done
8. **Admin user views** — `AdminUserListView`, `AdminUserDetailView`, `AdminUserSecurityView`,
   `AdminSessionListView`, other user/session view components, fixture label in `AdminDemoAdapter.tsx`.
   Status: done (dialog footer check in 17.4)
9. **Admin realm views** — `AdminRealmOverviewView`, `AdminRealmView`, `AdminSignInView`, `AdminEventListView`.
   Status: done
10. **Organization views A** — `OrganizationAdmin{List,Detail,Memberships,Invitations}View`,
    `OrganizationAdminRoleChooser`, fixture label in `OrganizationAdminDemoAdapter.tsx`. Status: done
11. **Organization views B** — `OrganizationAdmin{Domains,Branding,LoginPolicy,SecurityPolicy}View`.
    Status: done
12. **Project views** — `src/features/projects/ui`. Status: done
13. **OIDC views** — `src/features/oidc/ui/OidcAdmin*.tsx` + fixture label in `OidcAdminDemoAdapter.tsx`.
    Status: done
14. **Machine user & impersonation views** — `src/features/machineUsers/ui/MachineAdmin*.tsx`,
    `src/features/impersonation/ui/ImpersonationAdmin*.tsx` + their demo adapters' fixture label.
    Status: done
15. **Demo chrome** — `src/features/demo/ui/{DemoFixtureStateSelector,DemoDirectory,DemoDirectoryGroup,
    DemoDirectoryScenarioCard,DemoScenarioPlaceholder}.tsx`. Status: done
16. **Account/invitations control swap** — `src/features/account/ui/**`: control swap per the view rules and
    inner-padding alignment with the new section inset; no layout rework.
    - 16a security: `AccountPasswordView`, `AccountRecoveryCodesSection`, `AccountFactorsSection`,
      `AccountPasskeysSection`, `AccountSecurityHistorySection`, `AccountSessionsSection`,
      `AccountRefreshTokensSection`, `AccountConsentsView`, `AccountDeleteView`. Status: done
    - 16b profile/access: `AccountIdentitiesSection`, `AccountEmailAddressView`, `AccountProfilePhoneSection`,
      `AccountProfilePictureField`, `AccountProfileView`, `AccountOrganizationSelector`, `AccountOrganizationPanel`,
      `AccountInvitationView`, `AccountEffectiveAccessView`. Status: done (vendored by design: organization tabs
      `Button variant="none"`, identity copy `ButtonIconOnly` (test-pinned), gender `SelectSingle` listbox)
17. **Visual QA & polish**
    1. Shell polish — `authenticatedNavigationClasses.ts`, `AdminDemoApp.tsx` (+ state),
       `ProductionAuthenticatedShell.tsx` (+ state), `AuthenticatedBrandMark.tsx`, and in `src/ui/styles.css` only
       the `.authenticated-language-selector`/`.authenticated-pill-select` rules: per "Shell" (toggle icons, drawer
       redundancies, active state, brand mark, header icon sizes, mobile header fit incl. the language label).
       Status: done
    2. Focus shell & sign-in — `ProductionFocusShell.tsx`, `ProductionStatePanel.tsx`, `AdminSignInView.tsx`: per
       "Dialogs & states". Status: done
    3. Primitive polish — `AuthenticatedDialog.tsx`, `AuthenticatedToolbar.tsx`, `AuthenticatedButton.tsx`: dialog
       close button, mobile toolbar row, `iconRight` while loading/validating. Status: done
    4. Consistency sweep of finished views (`AdminUser*`, `AdminSession*`, `AdminRealm*`, `AdminEvent*`,
       `OrganizationAdmin{Detail,Memberships,Invitations}View`, `OrganizationAdminRoleChooser`,
       `src/features/projects/ui`): dialog footers end-aligned, `size="sm"` for section-header/row actions,
       `triggerSize="sm"` for dialog triggers in section headers, leftovers of the view rules. Status: done
    5. Final QA pass: (a) capture the before set again into `/tmp/authworks-shots/final/` (same file names) plus
       functional checks; (b) design review of final vs. before vs. login → fix list → small fix tasks.
       Status: (a) done — 28 final screenshots, all smoke checks pass, no console errors, no 390px overflow;
       (b) done — verdict: consistent with the login and clearly better than before; accepted findings → 17.10–17.13;
       rejected: renaming the demo "Directory" link (e2e-pinned name), new count summaries (would need new i18n
       keys), overview card heights (taste)
    6. Regression diagnosis: demo "create organization" (and "create project") dialogs no longer open. Root cause:
       `AuthenticatedToolbar.tsx` (Task 17.3) wraps summary + actions in `<Show when={props.summary || props.actions}>`;
       without a summary this evaluates the `actions` JSX getter twice and creates competing dialog instances.
       Status: done (diagnosed; fix in 17.8)
    7. Alias cleanup in org-settings, OIDC, machine, impersonation, demo, production files. Status: done
    8. Fix: resolve JSX props once in shared primitives (`AuthenticatedToolbar`, `AuthenticatedSection` actions,
       `AuthenticatedDialog` trigger label via `children()`). Status: done — all demo create dialogs open/close again
    9. Alias cleanup in the remaining files. Status: done (no aliases left in `src`)
    10. OIDC/machine/org polish — `OidcAdminClientDetailView` (secret actions aligned with the secret value box),
        `OidcAdminClientFormFields` ("Trusted" hint directly under its checkbox), `OidcAdminClientListView` +
        `MachineAdminListView` (descriptive sentence moves out of the toolbar `summary` into a muted description,
        text unchanged), `OrganizationAdminLoginPolicyView` (option cards: status pill stacked under the label,
        consistent alignment); destructive-trigger rule in these files. Status: done
    11. Destructive-trigger rule in the remaining views (`src/features/projects/ui`, `OrganizationAdminDetailView`,
        `MachineAdminDetailView`, `MachineAdminCredentialTable`, `ImpersonationAdminView`) + dialog title wrapping in
        `AuthenticatedDialog.tsx` (`break-all` → wrap long tokens only). Status: done
    12. Account header controls: the account workspace navbar and the demo account bar use the pill language
        selector (`authenticated-language-selector`) and `AuthenticatedThemeToggle` (≥ `sm`; `ThemeButton` below);
        no structure change. Status: done (demo bar hides its duplicate controls when the workspace toolbar shows
        them)
18. **Final verification**
    - a: `bun run check` once; fix failures in redesign files; report others. Status: done — passes (1,250 unit +
      6 built-output tests; one transient CLI test flake unrelated to UI)
    - b: full e2e suite against the dev server (237 passed, 34 failed, 47.9 min, log `/tmp/authworks-e2e-full.log`);
      classification: A redesign 1 (`accountProfilePages.spec.ts:30` dialog close button name), B stale/pre-existing
      28, C sessions-list feature 2, D hardcoded port 5174 3, flaky 0. Status: done
    - d: fix A — the dialog close button's accessible name must equal the pre-redesign name exactly. Status: done
      (Corvu's own `aria-label="close"` restored; translated `title` kept)
    - e/f: evidence check of the B class — a failure is pre-existing only if no file in its causal chain changed
      since `b5d89d7` (`git diff b5d89d7 -- <file>`), or the change provably doesn't cause it. Status: done — 24
      confirmed pre-existing (stale specs: closed-by-default account disclosures, wrapper divs in the security grid,
      dialog-only "Display name", removed account headings/navigation); `oidcAdminProduction.spec.ts:55/74/105/165`
      unexplained (not the proxy, no relevant UI removal) → 18g
    - g: decisive diagnosis of the 4 OIDC production failures. Status: done — pre-existing: the spec's client fixture
      (`e2e/oidcAdminProduction.spec.ts:11–24`) lacks `accessTokenRoleAssertion`, `additionalOrigins`,
      `idTokenUserinfoAssertion`, required since schema commit `1a52758` (before `b5d89d7`); responses fail validation
    - c: `bun run check` after 17.10–17.12 and 18d. Status: done — passes (1,250 unit + 6 built-output tests)
    - h: final full e2e run; compare failing titles with 18b (expected: the 33 remaining known failures); classify
      only new failures. Status: in progress

### View task rules (Tasks 8–14, 16)

- `ButtonIcon`/`Button` → `AuthenticatedButton` (same props/variant); drop pure sizing classes (`h-7`, `h-8`,
  `text-xs`); `size="sm"` for row, record-item, section-header and inline actions.
- `Input` → `AuthenticatedInput`; `SelectSingleNative` → `AuthenticatedSelect`; raw `<select>`, `<input>`,
  `<textarea>` and checkboxes use `authenticatedControlClasses`.
- Uppercase letter-spaced micro-labels → `text-xs font-medium text-muted-foreground` (sentence case).
- Inner content of non-padded sections aligns with the section header inset (`px-3` → `px-5`).
- Truncated identifier cells get a `title` with the full value.
- Dialog forms: submit actions end-aligned (`flex justify-end gap-2`), no full-width submit buttons.
- Destructive triggers in views (revoke/remove/delete/disable buttons that open a confirmation) use `outlineRed`
  (`size="sm"` in rows, record items and section headers); only the final confirmation (ConfirmDialog accept) is
  `filledRed`. Account views keep their variants.
- Apply the form layout rules above. Keep text, aria, roles, `data-*`, ids, behaviour and state files unchanged.

## Current context

- Dev UI: `http://127.0.0.1:5180` (`UI_PORT=5180 bun run dev:ui -- --host 127.0.0.1`, PID 852764,
  log `/tmp/authworks-vite-ui.log`).
- Baseline: the user committed and pushed the in-progress redesign as `eeb2537` (plus `7b07cfa` dev proxy fix);
  later work is uncommitted on top of HEAD. `eeb2537` also contains another actor's admin sessions-list feature
  (`AdminSessionListView.tsx`, `sessionList` adapters/state, `adminSessionList.test.ts`) — not part of this redesign.
  This plan file is untracked (the user reverted its commit) — leave it uncommitted.
- Another actor may edit the repo concurrently: only touch files of your task; never revert changes you didn't make.
- Before screenshots: `/tmp/authworks-shots/before/`; production login `/tmp/authworks-shots/prod/`; after
  screenshots per task in `/tmp/authworks-shots/after/task<N>/`.
- Control APIs (`src/ui/authenticated/`): `AuthenticatedButton` (vendored `ButtonIcon` props + `variant`, `size`);
  `authenticatedButtonClassGet(variant?, size?, iconOnly?, ...customClasses)`; `AuthenticatedInput`;
  `AuthenticatedSelect` (`getOptions: () => string[]`, `valueSignal: SignalObject<string>`, optional `valueText`,
  `class`, `id`, `disabled`, ARIA attrs); `authenticatedControlClasses`; `AuthenticatedThemeToggle` (`class?`);
  `AuthenticatedBrandMark` (`class?`, merged last); dialog helpers `authenticatedDialogClasses.ts`,
  `authenticatedDialogTriggerClassGet.ts`; `AuthenticatedDialog` prop `triggerSize?: "sm" | "md"` (default `md`).
- Focus-shell context styling uses Tailwind variants `in-[[data-shell=focus]]:…` (verified working).
- Solid pitfall: a JSX prop (`props.actions`, `props.children`, …) is a getter that creates new nodes on every read.
  Never read it in a condition and render it again; use `children(() => props.x)` or `<Show when={props.x}>{(x) => x()}`.
- `authenticatedNavigationClasses` keys: `aside`, `contentOffset`, `brandRow`, `brandLink`, `footer`, `footerButton`,
  `frame`, `groupHeading`, `groupSection`, `link`, `linkActive`, `linkInactive`, `nav`, `header`, `headerStart`,
  `headerEnd`, `headerBrand`, `headerBrandMark`, `headerLink`, `sidebarToggle`, `mobileContent`, `mobileTitle`,
  `mobileDescription`, `content`. Reference shell: `src/features/admin/ui/AdminDemoApp.tsx`.
- e2e notes (not caused by the redesign): `productionShells.spec.ts` has 4 failures identical before and after
  Task 6 (account-navigation expectations stale vs. HEAD); `impersonationProduction.spec.ts` hardcodes port 5174 for
  an auxiliary context; `adminDemo.spec.ts:69–71` expects "Administrator session active" on `/demo/admin/sessions`,
  which now renders the new sessions list (same cause: `adminRealmProduction.spec.ts:119`
  `[data-admin-session='active']`); `task19LandmarkSweep.spec.ts:42–44` queries the account email list inside a
  collapsed disclosure. At HEAD, `adminTask19` (8), `adminRealmDemo` (7), `adminTask20Signoff` (4) and
  `task19AdminSweep` (60) pass.
