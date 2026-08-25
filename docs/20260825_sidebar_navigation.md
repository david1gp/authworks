# Sidebar navigation

## Goal

Move the realm, organization, language, and theme controls into the sidebar and remove the top navigation bar for a cleaner, minimal application shell.

## Decisions

- Preserve the existing control behavior and responsive accessibility.
- Reuse the existing sidebar and navigation components rather than introducing a new shell abstraction.
- Remove the top navigation bar completely, including the space reserved for it.
- Keep generated shared sidebar components unchanged; make the shell-level composition change in `ProductionAuthenticatedShell.tsx`.

## Approach

- Inspect the current application shell, sidebar, top navigation, and relevant tests.
- Relocate the four controls with the smallest component and styling changes.
- Update focused tests and verify the resulting UI and repository checks.

## Tasks

- [x] 1. Identify the shell, sidebar, top navigation, tests, and responsive behavior affected by the move.
- [x] 2. Move realm, organization, language, and theme controls into the sidebar and remove the top navigation bar.
- [x] 3. Verify focused behavior, visual/responsive rendering, and the full repository check.

## Paths

- Plan: `docs/20260825_sidebar_navigation.md`
- Source: `src`
- Shell: `src/ui/production/ProductionAuthenticatedShell.tsx`
- Styles: `src/ui/styles.css`
- Controls: `src/ui/i18n/ui/LanguageSelector.tsx`, `ui/interactive/theme/ThemeButton.tsx`
- Tests: `e2e/productionShells.spec.ts`
