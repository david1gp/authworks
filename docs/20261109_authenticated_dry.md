# Authenticated UI de-duplication

## Goal

Fix the non-DRY list between `src/ui/authenticated/*` and the vendored `ui/*`
kit without breaking behavior or visuals, then commit, merge to `main`, push,
and deploy.

## Decisions (user-confirmed 2026-11-09)

- Approach: authenticated components wrap the vendored `ui/` primitives.
  `ui/` itself is read-only (rsync from `../solid-ui` overwrites it) — never
  edit vendored files. Overrides live in `src/ui`.
- Visuals: preserve the exact authenticated look. Wrappers must reproduce the
  current rendered classes exactly. Anything a `ui/` primitive cannot express
  without visual change stays local and is reported, not forced.
- Scope: all real duplicates, plus a new compact button size for the `size-7`
  one-offs. `AuthenticatedTabs` vs `TabsTop` and `AuthenticatedThemeToggle`
  vs `ThemeButton` are not duplicates (router links vs signal panels;
  render-only over shared `themeSignal`) — leave them alone.

## Constraints

- Start from the prior thread's uncommitted work: apply
  `/tmp/authworks-prior-button-props.patch` first
  (`authenticatedButtonProps` extends `ButtonIconProps`).
- Preserve every public prop and behavior of the authenticated components,
  including tuple `onClick` support in `authenticatedButtonStateCreate`
  (vendored `ButtonIcon` silently drops non-function handlers — do not lose
  this).
- Code style: one export per file, subject-first names, view-only `.tsx`
  (logic in sibling `*StateCreate.ts`), explicit relative `.js` specifiers.
- Use only dependencies already in `package.json`.
- Tests: Bun, `--max-concurrency=1`. Per task run only targeted tests
  (`bun --conditions=browser test --max-concurrency=1 <files>`); after a
  failure re-run only the failing file. Full `bun run check` only at the end.
- Prove no visual break: rendered class output for each touched component
  must match the pre-change output (compare via existing tests or a small
  probe under `/tmp`, never committed).

## Tasks

0. Baseline: `bun install`, apply the patch above, confirm green typecheck
   (`bunx tsc --noEmit` per repo config / `bun run typecheck`) and targeted
   UI tests on the untouched tree.
1. Button family: `AuthenticatedButton` wraps `ButtonIcon`
   (`ui/interactive/button/`); dedupe blocked-click, loading spinner,
   validation swap, and icon left/right behavior. Add a compact size
   (name per existing conventions) and migrate the native one-offs: copy
   button in `AuthenticatedCopyableId`, sort/row buttons in
   `AuthenticatedDataTable`, option buttons in `AuthenticatedThemeToggle`
   (only if semantically a button use, else report). Collapse the three
   danger-outline recipes (`authenticatedDangerOutlineButtonClass`,
   `outlineRed` callers, `authenticatedButtonClassGet`) to one, and remove
   the `authenticatedDialogTriggerClassGet` bridge if callers can use the
   unified button path.
2. Input/Select: `AuthenticatedInput` wraps `ui/input/input/Input`;
   `AuthenticatedSelect` wraps `ui/input/select/SelectSingleNative`.
   Keep `authenticatedControlClasses` output identical.
3. Dialog/ActionMenu: `AuthenticatedDialog` wraps
   `ui/interactive/dialog/CorvuDialog`; `AuthenticatedActionMenu` wraps
   `ui/interactive/popover/CorvuPopover`. Preserve chrome, focus restore,
   trigger handling, item model, and keyboard navigation.
4. Chip/Status: `AuthenticatedChip` and `AuthenticatedStatus` wrap
   `ui/static/badge/Badge` with tone mapping; rendered pill classes
   identical per tone.
5. Full verification: `bun run check`; browser visual check of
   representative admin/account/demo views against pre-change rendering.

## Ship

- Commits skill: multiple conventional commits, logically grouped.
- Merge branch into `main`; re-run `bun run check` on `main`.
- Clean up worktree, branch, patch file, any dev servers started.
- `git push`, then `bun run deploy` (`prodctl deploy`).
- Validate production: `bun run smoke:public`, `bun run test:e2e`.
  Fix anything broken, commit, push, redeploy as needed.

## Status

- [x] 0 Baseline — typecheck green; `test/ui` green except one verified
  pre-existing failure (`i18n.test.ts`, fails identically on the clean tree).
  Class snapshot at `/tmp/authworks-baseline-classes.txt`.
- [x] 1 Button family — wrapping vendored `ButtonIcon` proved impossible
  under exact visuals (9 residue classes survive its merge chain;
  `/tmp/authworks-button-probe.ts`); local render kept per plan rule. Shared
  props contract, restored `size` API (`sm` = size-7), copy-button migration,
  danger-outline collapse, and dialog-trigger delegation done; exact classes
  re-verified against baseline (incl. `shadow-xs` and legacy `contrast`).
  Deliberately unmigrated: ThemeToggle options (segmented `aria-pressed`
  control), DataTable sort/row buttons (no button-recipe shape).
- [x] 2 Input/Select — wrapping proved impossible under exact visuals for
  both (`/tmp/authworks-input-select-probe.ts`): vendored `Input` leaves 7
  residue classes (`rounded-md`, `py-2`, focus rings, `file:*`, …) removable
  via no public prop; `SelectSingleNative` concatenates its gray base palette
  (`classArr`, no merge), has fixed icon classes, and no `aria-*` passthrough
  (call sites use `aria-label`). Both stay local; zero files changed.
- [x] 3 Dialog/ActionMenu — wrapping proved impossible under exact visuals
  and behavior (`/tmp/authworks-dialog-actionmenu-probe.ts`: 13 mismatches).
  Vendored chrome has no neutralizing props (overlay, content `dark:` palette,
  fixed close/header), and `CorvuDialog`/`CorvuPopover` lack required behavior
  props (`dialogId`, focus/trap/close controls, `onFinalFocus`, rest spread).
  Both stay local; zero files changed.
- [x] 4 Chip/Status — wrapping `Badge` proved impossible under exact visuals
  (`/tmp/authworks-chip-status-probe.ts`: 20/20 tone combos fail; focus-ring
  residue on every variant) and DOM identity (`Badge` renders `<div>`, both
  render `<span>`; Chip is used inside a `<button>`). Intra-pair dedupe also
  rejected (different structure). Both stay local; zero files changed.
- [x] 5 Full verification — `bun run check` stages pass; full suite without
  bail: 2098 pass / 1 fail, the fail being the verified pre-existing
  `i18n.test.ts` catalog gap (identical on clean tree, stash-proven). Build +
  build tests pass. All five class probes re-confirmed. Headless-Chromium
  pass over `/demo`, `/demo/account`, `/demo/admin/ui-kit`: 0 page errors,
  changed components (incl. outlineRed+`shadow-xs` dialog button) render
  correctly. Production authed routes unverified (need backend session).
- [ ] Ship (commits, merge, push, deploy, smoke/e2e)
