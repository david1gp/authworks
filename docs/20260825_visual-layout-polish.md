# Visual layout polish

## Goal

Make authenticated navigation and login controls visually consistent: collapsed sidebars release their layout space, all requested sidebar and navbar entries use consistent MDI icons at the shared default size, and login language/theme controls sit below the legal terms.

## Decisions

- Use the existing shared `Icon` component and MDI path imports; do not add a parallel icon abstraction.
- Keep icon sizing at the shared default (`size-6`) by omitting per-use size classes.
- Store sidebar item icon paths in the navigation model so every renderer uses the same mapping.
- Preserve existing responsive breakpoints, routes, labels, accessibility names, and behavior except for the requested layout changes.
- Cover production and demo authenticated shells where the same sidebar behavior exists.
- Update both normal and unavailable login frames so their control placement remains consistent.

## Approach

- Extend authenticated navigation metadata with semantic MDI icons and render it through the shared icon component.
- Add icons to shell-level controls and status/actions, including Realm, Organization, Language, Signed in, and Sign out.
- Make desktop content offsets conditional on desktop sidebar state while preserving mobile drawer behavior.
- Reorder login legal and preference controls, then verify layouts and interactions at desktop and mobile widths.

## Tasks

- [x] 1. Fix production and demo desktop sidebar collapse spacing and add focused regression coverage.
- [x] 2. Add consistent MDI icons to authenticated sidebar entries, status/actions, and navbar selectors using default icon sizing.
- [x] 3. Move login language/theme controls below legal terms in normal and unavailable frames and update coverage.
- [x] 4. Run repository checks and browser verification for desktop/mobile authenticated and login layouts.

## Paths

- Plan: `docs/20260825_visual-layout-polish.md`
- Production shell: `src/ui/production/ProductionAuthenticatedShell.tsx`
- Production navigation: `src/ui/production/productionShellNavigationGroups.ts`
- Production navigation model: `src/ui/production/productionNavigationItem.ts`
- Demo admin shell: `src/features/admin/ui/AdminDemoApp.tsx`
- Login frames: `src/features/login/ui/LoginFrame.tsx`, `src/features/login/ui/LoginUnavailableFrame.tsx`
- Shared styles: `src/ui/styles.css`
- End-to-end coverage: `e2e/productionShells.spec.ts`, `e2e/adminDemo.spec.ts`, `e2e/loginParity.spec.ts`, `e2e/loginProduction.spec.ts`
