# Authenticated UI redesign

## Goal

Redesign every authenticated admin, account, and invitation page into one beautiful, cohesive, information-dense interface inspired by Linear, macro, and the existing login design. Reduce excessive padding, group related information into clear sections, show materially more useful content per viewport, remove the realm chooser, and leave no legacy authenticated page visually untouched.

## Decisions

- Keep the login experience as the visual foundation; extend its typography, focus treatment, color discipline, and branded feel into authenticated surfaces.
- Use a compact neutral shell with hairline borders, restrained radii, minimal shadows, dense controls, and one accent color.
- Remove the realm chooser entirely because the product has one realm; retain organization context only where it is operationally relevant.
- Keep existing routes and permissions unless combining duplicated presentation can be done without changing behavior or contracts.
- Admin defaults to compact density; account and invitation pages use the same system with slightly more breathing room.
- Prefer sectioned page composition, compact summary strips, dense tables/lists, and side-by-side related panels over isolated oversized cards.
- Long identifiers and technical values use compact single-line presentation with truncation where necessary.
- Shared authenticated composition belongs in `src/ui`; feature-specific page composition stays with its owning feature.
- Do not edit vendored `ui/` components locally.
- All interface copy continues through the existing i18n catalog.

## Approach

- Current context: the shared foundation and compact shells are complete. All 48 reachable authenticated demo routes and every production route family use the cohesive dense system. The exhaustive desktop/mobile sweep found and resolved remaining legacy presentation, duplicate landmarks/headings, contrast, responsive technical-value, email, dialog, and state-surface issues.
- Establish the shared visual tokens and compact authenticated primitives first.
- Redesign the shell, navigation, page header, organization context, and responsive behavior as one coherent frame.
- Migrate each feature family page-by-page onto the shared section, toolbar, panel, list, and table language.
- Consolidate visually duplicated pagination and page framing while preserving feature boundaries.
- Complete desktop, mobile, light, dark, accessibility, and full repository verification after every route family is migrated.

## Tasks

- [x] 1. Build the authenticated design foundation: compact tokens, shared page header, section/panel, toolbar, dense data presentation, status, and pagination composition.
- [x] 2. Redesign the authenticated shell and navigation; narrow and densify the sidebar, remove the realm chooser, simplify context controls, and make mobile navigation cohesive.
- [x] 3. Redesign the core admin pages: overview, realm settings, user directory/detail/security/sessions, realm sessions, events, sign-in, and impersonation.
- [x] 4. Redesign organization admin pages: organizations, detail, memberships, invitations, domains, branding, and login policy.
- [x] 5. Redesign project admin pages: projects, detail/settings, applications, roles and grants, and effective access.
- [x] 6. Redesign OIDC admin pages: clients, client detail, signing keys, consents, and protocol documents.
- [x] 7. Redesign machine identity admin pages: machine users, detail, and credentials.
- [x] 8. Redesign all authenticated user pages: account overview/profile/email/password/delete, organizations/access/consents, sessions/passkeys/factors/recovery codes/identities/tokens/security history, and invitation overview/acceptance.
- [x] 9. Sweep every authenticated demo and production route for legacy styling, reduce or consolidate redundant presentation, and correct responsive, dark-theme, accessibility, and visual consistency issues.
- [ ] 10. Run route-level browser verification and the full repository check; fix all regressions until every authenticated route is reworked and passing.

## Paths

- `src/ui/styles.css`
- `src/ui/production/`
- `src/ui/i18n/model/englishCatalog.ts`
- `src/features/admin/ui/`
- `src/features/organizations/ui/`
- `src/features/projects/ui/`
- `src/features/oidc/ui/`
- `src/features/machineUsers/ui/`
- `src/features/impersonation/ui/`
- `src/features/account/ui/`
- `src/features/invitations/ui/`
- `e2e/`
