# Authworks login + administration UI

## Goal

Vendor `./ui` from `../solid-ui`, then port the zitadel-login screens and add an administration web UI for already-ported domains. Demo at `/demo` with login and admin cards.

## Decisions

- Copy `/home/david/adaptive/solid-ui/ui` into `./ui` (codeline vendor pattern). Import via `#ui/*`. Do not invent primitives; stop if a needed primitive is missing.
- Frontend: SolidJS + Vite + Tailwind v4, matching `/home/david/adaptive/codeline`. No Rsbuild for the app (codeline does not use it).
- Feature-first: login/admin screens live under `src/features/<feature>/ui`. Shared context-agnostic primitives stay in `./ui`. Demo composition lives under `src/features/demo`.
- Reuse existing authworks public schemas. Rename instance → realm. Do not duplicate transport schemas. Keep UI-only view/state schemas when they are not server contracts.
- Port only capabilities already in this repo. Skip ZITADEL-only MFA (SMS OTP, U2F) and unique console features.
- Login first, then admin. Prefer grok subagents for UI.
- Admin needs list APIs that already exist (orgs, users, projects, roles) plus a new public events list API over the existing event table.
- Login needs a composed bootstrap read model from existing organization branding + login policy + providers. Do not recreate those schemas.

## Approach

1. Vendor `./ui` and wire Vite/tsconfig/`#ui` like codeline.
2. Add a thin Solid shell (`src/ui`) that routes `/demo`, `/demo/login`, `/demo/admin`, plus production login/admin mounts.
3. Port login panels into feature `ui/` folders, binding to authworks schemas/clients.
4. Add admin list/detail screens for organizations, users, projects/roles, events.
5. Visual-check with a browser, then Playwright e2e for demo + core lists.

## Tasks

- [x] 1. Vendor `./ui` from `../solid-ui/ui`. Add Vite, `index.html`, `#ui` aliases, Tailwind CSS, frontend deps, `dev:ui` / `ui` rsync scripts. Match codeline tsconfig JSX/DOM/`#ui` paths. Do not add login/admin screens yet.
- [x] 2. Thin web shell: `src/ui/main.tsx`, styles, router. `/demo` shows two cards (administration + login). `/demo/login` and `/demo/admin` placeholders. Serve via Vite; proxy API to the existing Hono server.
- [x] 3. Login UI port (feature-first): LoginFrame, method chooser, password, email OTP, passkey, IdP, MFA (TOTP/email/passkey only), recovery. Reuse authworks public schemas. Demo scenarios under `/demo/login/...`.
- [x] 4. Login bootstrap composition: reuse existing `GET /api/v2/bootstrap` (`organizationDiscoveryResponseSchema`) instead of a duplicate read model. Derive primary methods from login policy flags.
- [x] 5. Admin UI: sidebar + list/detail for organizations, users, projects (roles nested), events. Reuse `#ui` Table/Button/Input/Dialog/Sidebar/Card. Fake or live data in `/demo/admin`.
- [x] 6. Public events list API + client (cursor list, no secrets) for the admin events screen.
- [x] 7. Visual browser check of `/demo`, `/demo/login`, `/demo/admin` and key screens.
- [x] 8. Playwright e2e for demo directory + login scenario navigation + admin list pages.

## Paths

- Plan: `docs/20260819_login_admin_ui.md`
- Vendored UI: `ui/`
- App shell: `src/ui/`
- Features: `src/features/{passwords,emailOtp,passkeys,mfa,externalIdentities,sessions,organizations,users,projects,realms,demo}/ui`
- Login reference: `/home/david/adaptive/zitadel-login/client/src`
- UI kit source: `/home/david/adaptive/solid-ui/ui`
- Tooling reference: `/home/david/adaptive/codeline`
- Admin reference: `/home/david/opensource/zitadel/console`
