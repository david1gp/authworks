# Account workspace

## Goal

Replace the sparse account subpages with one responsive `/account` workspace that uses wide screens efficiently, keeps account operations independently usable, and simplifies authenticated navigation.

## Decisions

- `/account` is the only account workspace URL; legacy account subpage URL compatibility is not required.
- Use sticky in-page anchors for Profile, Security, Devices and applications, Access, and Danger zone.
- Combine duplicated profile and sign-in identity details into one summary.
- Put organization switching, language, theme, actor, and sign-out in the sticky global navbar.
- Remove account subpage entries and the static Authworks / Account page header.
- Keep contextual sidebar navigation for administration and invitation flows.
- Use independently loaded and fault-isolated account sections rather than one blocking account state.
- Give profile details an eight-column area and profile picture a four-column area on wide screens; stack them on small screens.
- The profile-picture field is a keyboard-accessible file picker and drag-and-drop target with empty, preview, replacing, and removing states.
- Keep feature behavior under `src/features/account/ui` and shared shell behavior under `src/ui`.

## Approach

- Compose existing profile, security, access, and account-operation state/actions into a single workspace while preserving their independent status and error handling.
- Convert route-oriented account views into reusable workspace sections where needed, without merging unrelated state factories.
- Add a production account navbar and responsive account anchor navigation while leaving admin navigation contextual.
- Reuse existing authenticated sections, records, dialogs, statuses, i18n, and account API contracts.
- Update focused UI and end-to-end coverage, then run the repository-wide check.

## Tasks

- [x] 1. Build the single-page account workspace composition and independent section loading.
- [x] 2. Consolidate profile identity/details and add the dedicated profile-picture drop area.
- [x] 3. Replace account sidebar/header framing with the sticky global and section navigation.
- [x] 4. Remove obsolete account route/navigation contracts and align demo/production composition where required.
- [x] 5. Update focused tests and complete repository verification.

## Paths

- `src/features/account/ui/`
- `src/ui/production/ProductionAuthenticatedShell.tsx`
- `src/ui/production/ProductionRouteApp.tsx`
- `src/ui/production/productionRouteContractMap.ts`
- `src/ui/production/productionShellNavigationGroups.ts`
- `src/ui/i18n/model/englishCatalog.ts`
- `e2e/accountProfilePages.spec.ts`
- `e2e/productionShells.spec.ts`
- `e2e/accountAccessProduction.spec.ts`
- `test/ui/productionRoutes.test.ts`
