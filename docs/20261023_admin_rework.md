# Admin rework — org-owner first

Status: in progress

## Goal

Rework production `/admin/**` so an organization owner lands on a clear, beautiful **Users** page and finds **Roles**,
**Projects** and **Configuration** next to it. Realm administrators additionally get a collapsed **Realm** group.
Fix the authorization model so organization owners/admins are no longer implicit realm administrators. Validate
everything with a resumable, self-cleaning E2E suite (production default, dev optional).

## Decisions (user-approved)

1. Real **realm administrator** role, stored per realm for users. Org owners/admins manage only their organization.
2. Org owners/admins see users of the **active organization**. Realm administrators also get an "All organizations"
   scope with an Organizations column.
3. **Owner vs Admin**: Admin manages non-owner members, users of the org, roles, projects, service accounts. Only Owner
   changes branding, sign-in & security policy, domains, org name/status (incl. removal) and manages owners.
4. Realm screens live in a **collapsed "Realm" group** in the same sidebar (realm admins only).
5. Demo `/demo/admin/*` is kept **only for the new pages** (fixture adapters); old demo routes/views are removed.
6. Keep the current visual language (blue accent, slate neutrals, light/dark, `src/ui/authenticated` primitives).
7. One-time backfill: when a realm has no administrators, the active owners of its oldest active organization become
   realm administrators (Contentoren owners on production).
8. Production E2E access: a dedicated human **service user `authworks-e2e-service`** who is a realm administrator.
   Credentials live in `.env.production` (git-ignored, mode 0600) as `AUTHWORKS_E2E_SERVICE_USERNAME` /
   `AUTHWORKS_E2E_SERVICE_PASSWORD`. Provisioned once on the server with the system secret via
   `scripts/e2eServiceUserEnsure.ts`.
9. **Purge** (API only, no UI): realm administrators can permanently delete users already in state `deleted` and
   organizations already in status `removed`. Purge removes rows (FK cascades, plus non-FK references) and the audit
   events of every purged aggregate. Event deletion stays blocked for everything else.
10. Realm administrators can **set a user's password** (tenant API + profile action).
11. User-profile "Activity" tab is dropped; recent sessions on the Security tab cover it.
12. Tenant audit-event list is realm-administrator only.
13. Existing non-admin E2E specs are kept and orchestrated; old admin specs are deleted. New admin workflows are
    folder-per-workflow, file-per-step.
14. E2E state dir: `/tmp/opencode/authworks/e2e/` if writable, else `/tmp/<user>-opencode/authworks/e2e/` (on this
    machine `/tmp/opencode` belongs to another user). Override with `AUTHWORKS_E2E_STATE_DIR`.

## Information architecture

Sidebar — organization section (visible when the actor is realm admin or owner/admin of the active org):

- Users `/admin/users` — default landing; `/admin` redirects here
- Roles `/admin/roles`
- Projects `/admin/projects`
- Configuration `/admin/configuration/general`

Sidebar — "Realm" group, collapsed by default, realm admins only: Overview & settings `/admin/realm`, Administrators
`/admin/realm/administrators`, Organizations `/admin/organizations`, Default sign-in policy `/admin/login-policy`,
OIDC clients `/admin/oidc-clients`, Signing keys `/admin/signing-keys`, Consents `/admin/oidc-consents`, Protocol
documents `/admin/protocol-documents`, Sessions `/admin/sessions`, Audit log `/admin/events`.

Kept routes not in the sidebar: `/admin/sign-in`, `/admin/impersonation`, `/admin/machine-users/:machineUserId`,
`/admin/machine-credentials`, `/admin/organizations/:organizationId`, `/admin/oidc-clients/:clientId`.

Header: org switcher (members: their orgs; realm admins: all active orgs), language, theme, user chip, sign out.

Redirects (client-side, `replace`): `/admin` → `/admin/users`; `/admin/branding` → `/admin/configuration/branding`;
`/admin/domains` → `/admin/configuration/domains`; `/admin/memberships` → `/admin/users`; `/admin/invitations` →
`/admin/users?tab=invitations`; `/admin/machine-users` → `/admin/users?tab=service-accounts`;
`/admin/configuration` → `/admin/configuration/general`; `/admin/projects/:id/applications|roles-grants|effective-access`
→ `/admin/projects/:id?tab=applications|roles|access`.

### Pages

- **Users** `/admin/users`: title + count; primary "Invite user", secondary "Create user" (realm admins only). Tabs
  (`?tab=`): People (default) · Service accounts · Pending invitations. Server-side search `?q=`. Realm admins: scope
  toggle `?scope=organization|all`. Optional `?role=` filter. People columns: User (avatar, display name, email), Role
  (org role chip; in `all` scope: organization names), Status, Last sign-in (relative text, absolute in `title`,
  "Never"), Created. Default sort `lastSignInAt` desc, nulls last; sortable headers `?sort=&dir=`. Row click → profile.
  Loading skeleton, empty state, error state, cursor pagination.
- **User profile** `/admin/users/:userId`: header card (avatar, name, email, status chip, last sign-in, member since) +
  "⋯" action menu (Deactivate/Reactivate, Unlock, Impersonate, Set password [realm admin], Delete). Tabs (`?tab=`):
  Overview (profile + contact, edit dialog) · Roles & access (org role as 4 selectable cards with descriptions — Owner
  card disabled unless actor is owner/realm admin; project roles grouped by project as chips; "Assign project roles"
  dialog: choose project → check roles; remove assignment; realm admins also see all org memberships and
  realm-administrator status) · Security (auth methods, sessions with revoke).
- **Roles** `/admin/roles`: Organization roles — 4 cards (Owner, Admin, Member, Guest) with plain-language
  description, what they can do, member count; click → `/admin/users?role=<id>`. Project roles — grouped by project,
  create/edit/delete via dialog.
- **Projects** `/admin/projects`: list (name, Owned/Shared badge, role count, app count, status) + "Create project".
  Detail `/admin/projects/:projectId` tabs (`?tab=`): Overview (name, flags with help text, status, danger zone) ·
  Roles · Applications · Access (org grants, user assignments, effective-access checker).
- **Configuration** `/admin/configuration/:section` with sub-nav: General (name, status, danger zone) · Branding
  (light/dark colours, font, watermark, legal URLs, **live preview** of a mini sign-in card from the current form
  values with light/dark toggle) · Sign-in & security (existing org login + security policy forms) · Domains. Non-owner
  admins see read-only forms with a notice.
- **Realm administrators** `/admin/realm/administrators`: list (user, added at, added by), add via user search picker,
  remove (last administrator cannot be removed).

## Backend contracts

Authorization:

- `realm_administrators(realm_id, user_id, created_at, created_by)` PK `(realm_id,user_id)`, FKs cascade to realms and
  users. Events `realm.administrator_granted|revoked`. One-time backfill (decision 7) guarded by a data-migration marker
  table `storage_data_migrations(name PRIMARY KEY, applied_at)` with name `realm_administrators_backfill_v1`.
- Routes: `GET /realms/:realmId/administrators` (realm.read) → items `{realmId,userId,createdAt,createdBy,user:{userName,
  displayName,email}}`; `POST /realms/:realmId/administrators {userId}` (realm.write); `DELETE
  /realms/:realmId/administrators/:userId` (realm.write, error `realms.administrator-last` when removing the last one).
  Same under `/system/realms/:realmId/administrators` (system secret).
- `realmAdministratorContextAuthorize`: `bootstrap_admin` → enforce as today; user in `realm_administrators` → enforce
  with roles `["realm_admin"]`; otherwise, only when `targetUserId` is given and permission ∈ {user.read, user.manage,
  user.impersonate}: allowed with the actor's own membership roles if the actor is active owner/admin of an org where
  the target is an active member — for `user.read` one shared org suffices; for `user.manage`/`user.impersonate` **all**
  of the target's active memberships must be in orgs the actor administers, the target must not be a realm
  administrator, and an admin (non-owner) may not manage an owner. Everything else → forbidden.
- `organizationContextAuthorize` and `projectContextAuthorize`: realm administrators (users) enforce with
  `["realm_admin"]`. Org switch and the session middleware membership check allow realm admins for any active org.
- Fixed roles: `admin` = event-free set {organization.read, organization.switch, organization.members.manage, user.read,
  user.manage, user.impersonate, machine.user.manage, machine.credential.manage, all project.*}; `owner` = admin ∪
  {organization.manage}; `member`, `guest` unchanged; `realm_admin` gains `realm.purge`. Tenant event list requires a
  realm administrator.
- `GET /realms/:realmId/me` capabilities: `{realmRead, realmAdministrator}` (`realmRead` = realm admin).

Users:

- `users.last_sign_in_at` (nullable), index `(realm_id,last_sign_in_at)`; `User.lastSignInAt` optional, same timestamp
  format as `createdAt`. Set in `sessionIssue` for user sessions without impersonation (same transaction, through a
  users server surface). One-time backfill from `MAX(sessions.created_at)` (marker `users_last_sign_in_backfill_v1`).
- `GET /realms/:realmId/users`: `search` (case-insensitive substring over userName, email, display/given/family name)
  and `sortBy ∈ createdAt|id|userName|lastSignInAt`; `lastSignInAt` sorts nulls last in both directions. `search` is
  added to the platform list query.
- `PUT /realms/:realmId/users/:userId/password {password}` — realm administrators only; replaces the credential and
  clears lockout.
- `POST /realms/:realmId/users/:userId/purge` — `realm.purge`; user must be `deleted`.

Organizations / projects:

- `POST /realms/:realmId/organizations/:organizationId/purge` — `realm.purge`; org must be `removed`; deletes org with
  cascades and all events of the org and of cascaded aggregates.
- Event purge mechanism: table `event_purges(aggregate_id PRIMARY KEY)`; the append-only delete trigger is recreated to
  abort unless `OLD.aggregate_id` is in `event_purges`; purge inserts ids, deletes events, clears `event_purges` in one
  transaction.
- `GET /realms/:realmId/projects?organizationId=` → projects owned by or granted to that org.
- Projects server surface `projectUserAssignmentListByUser({realmId,userId})`.

Directory feature (`src/features/directory/`, consumes other features only through public/server surfaces):

- `directoryUserSchema` = `{user:{id,userName,displayName,email,emailVerified,state,verificationState,createdAt,
  lastSignInAt?,pictureUrl?}, memberships:[{membershipId,organizationId,organizationName,roles,createdAt}]}`.
- `GET /realms/:realmId/organizations/:organizationId/users?search&role&sortBy&sortDirection&pageSize&pageToken`
  (user.read in that org) — default sort lastSignInAt desc nulls last.
- `GET /realms/:realmId/organizations/:organizationId/users/summary` → `{total, roles:{owner,admin,member,guest}}`.
- `GET /realms/:realmId/directory/users?...` (realm admin) — all non-deleted users with all memberships.
- `GET /realms/:realmId/users/:userId/access` (user.read on target) → `{realmAdministrator, memberships[],
  projectAssignments:[{assignmentId,projectId,projectName,projectOrganizationId,roleKeys,roles:[{key,displayName}]}]}`;
  non-realm-admins only see entries of orgs they administer.
- Browser API client for all of the above under the feature's `client/`.

## UI placement, screen keys, access

- `src/features/directory/ui/` (new): screens `users` `/admin/users`, `user-detail` `/admin/users/:userId`, `roles`
  `/admin/roles`, `realm-administrators` `/admin/realm/administrators`; picklist `directoryAdminScreenSchema`;
  `DirectoryAdminProductionAdapter.tsx`, `DirectoryAdminDemoAdapter.tsx`.
- `src/features/projects/ui/`: `projects` `/admin/projects`, `project-detail` `/admin/projects/:projectId` (`?tab=`).
- `src/features/organizations/ui/`: `configuration` `/admin/configuration/:section` (section ∈
  `general|branding|sign-in|domains`), `organizations`, `organization-detail`, `login-policy` (realm default policy).
- `src/features/admin/ui/`: `sign-in`, `realm` `/admin/realm` (overview + settings merged), `sessions`, `audit-events`.
- `oidc`, `machineUsers` (detail + credentials), `impersonation`: keys unchanged.
- Access seam: `productionShellAccessResolve(session) → {realmAdministrator: boolean, organizationRoles:
  OrganizationRoleId[]}` (active org). Route guard field `access: "organization-admin" | "realm-admin"` replaces the
  admin `permission: "realm.read"` gate. `organization-admin` = realm admin OR owner/admin of the active org.
  Nav items/groups carry the same `access` and are hidden when not satisfied.
- Realm admins' org switcher lists all active organizations (they may switch into any).

## UI conventions (all UI tasks)

- SolidJS; view-only `.tsx` with one `<name>StateCreate.ts` factory; one export per file; subject-first names;
  `Result` for fallible functions; valibot for all URL/localStorage state. Follow the `code-style` skill.
- Shared primitives in `src/ui/authenticated/` (task 5). Never edit vendored `ui/`.
- URL state: tabs `?tab=` or path, dialogs `?dialog=` (distinct values), search `?q=` written with debounced
  `history.replaceState` scheduled via `requestIdleCallback`, sort `?sort=&dir=`.
- List pages render the last successful response from `localStorage` (key `authworks.admin.<entity>.<realmId>.<orgId>`)
  and then refresh.
- All visible text via `messageTranslate`; page tasks add **English keys only** to
  `src/ui/i18n/model/englishCatalog.ts` (task-unique prefix, e.g. `admin.users.`; small unique anchors; never rewrite
  the file or `biome --write` it). Translations into the 14 `public/i18n/*.csv` happen in task 16a; until then
  `test/ui/i18n.test.ts` is expected to fail on missing keys — don't run it in page tasks.
- Each page: production adapter (API) + demo adapter (fixtures) mounted under `/demo/admin/...` (same path suffix).
- No raw IDs as primary content; IDs only as secondary text with copy affordance where needed.
- Use only existing dependencies (solid-js, @solidjs/router, @corvu/dialog, @corvu/popover, @adaptive-ds/mdi,
  valibot, tailwind). Do not add packages.

## E2E design

- Harness `e2e/harness/`: extended Playwright `test` that fails on any browser `pageerror` (all specs import `test`
  and `expect` from it), target resolution (`production` default: `https://authworks.contentoren.de`; `dev`: local
  server), state dir (decision 14), Valibot checkpoint schema, run id, test-name factory, service-user API client
  (password login → session cookie + CSRF), workflow step runner, cleanup.
- Checkpoint `<stateDir>/<target>/checkpoint.json`: `{version, target, baseUrl, runId, startedAt, completedSuites[],
  completedSteps[], entities:[{kind:user|organization|project, id, name, createdAt}], values:{}}`. Resume only for the
  same target and when younger than 24 h; older → clean its data, delete it, start a new run.
- Test data naming: prefix `e2e-aw-<runId>-` (`runId` = `yyyymmddhhmm-<6 base36>`); users
  `e2e-aw-<runId>-<role>` with email `e2e-aw-<runId>-<role>@example.com` (no mail is ever sent to them); organizations
  and projects `e2e-aw-<runId>-<name>`. Ownership = prefix + checkpoint entity record + server `createdAt`.
- Cleanup runs at the end of every invocation (`finally` + SIGINT/SIGTERM): via the service user, find users,
  organizations and projects matching `^e2e-aw-\d{12}-[a-z0-9]{6}-`; purge those older than 24 h (and the current
  run's data on success): delete projects, set orgs `removed` → purge, soft-delete users → purge; verify via API that
  none remain; delete stale checkpoints and dev state older than 24 h. On success also clear the checkpoint; on
  failure keep current-run data + checkpoint.
- Production workflows never send mail (no invitation creation, no email-change) and never upload files; the
  invitation workflow runs on `dev` only.
- `scripts/e2eRun.ts --target production|dev`: `test:e2e` (production) and `test:e2e:dev`. Runs suites sequentially,
  records each completed suite, skips completed ones on resume. Old `test:e2e:production-*` scripts fold into it.
  Production loads `.env` and `.env.production`. Dev starts a persistent local server (DB + generated system secret in
  `<stateDir>/dev/`) and provisions the service user with `scripts/e2eServiceUserEnsure.ts`.
- Fault injection for resume verification: `AUTHWORKS_E2E_FAIL_AFTER_STEP=<stepName>`.
- Workflows (`e2e/workflows/<workflowName>/`, one spec + one file per step):
  - `adminOrgOwner`: API setup (org, owner, member, project with 2 roles) → owner signs in → lands on Users sorted by
    last sign-in → search member → profile → change org role → assign project role → Roles counts → project detail
    tabs → Branding preview + save persists → sign out.
  - `adminOrgAdminLimits`: admin sees read-only Configuration, cannot grant Owner, no Realm group, realm URL denied.
  - `adminMemberDenied`: member cannot use `/admin`.
  - `adminRealmAdministrator`: service user sees Realm group, all-organizations scope, grants + revokes realm admin for
    a test user.
  - `adminInvitations` (dev only): invite, see pending, revoke.
  - Existing live specs (`productionAuthentication`, `productionAccountRegression`) keep using `AUTHWORKS_SSOTEST_*`
    on production; on dev the harness supplies a provisioned member user.

## Verification rules for subagents

- Allowed while implementing: `bun run typecheck`, `bunx biome check <changed files>` (`--write` only on files you
  own), `bun run check:no-literal-ui-text`, targeted
  `bun --conditions=browser test --timeout=30000 --isolate --max-concurrency=1 <test files>`.
- Not allowed unless the task says so: `bun run test`, `bun run check`, `bun run build`, Playwright/E2E.
- Ignore type errors in files owned by concurrently running tasks; report them.
- Do not commit; the main agent commits at milestones.
- **Never run git commands that change the working tree, index or stash** (`git stash`, `checkout`, `restore`,
  `reset`, `clean`, `add`, `commit`). Several agents work in the same tree concurrently. Read-only git (`status`,
  `diff`, `log`, `show`) is fine. To compare with baseline use `git diff` / `git show HEAD:<path>`.

## Tasks

Backend
1. [x] Realm administrators: table, backfill + marker table, actions, tenant + system routes, events, client, tests.
   (`realmAdministratorIs` server surface, `userDirectoryEntryResolve` users server surface.)
2. [x] `lastSignInAt` + user list `search`/sort (platform list query `search`, nulls-last), tests.
3. [x] Projects `organizationId` list filter + list item `roleCount`/`applicationCount` +
   `projectUserAssignmentListByUser` server surface, tests.
4a. [x] `realmAdministratorContextAuthorize` semantics + all call sites, fixed-role split, `realm.purge` permission,
   events list realm-admin only, `/organization-roles` + realm login-policy read access, `/me` capabilities, tests.
4b. [ ] Realm-admin branch in `organizationContextAuthorize` / `projectContextAuthorize`; machine-user human path
   via org context of the machine user's organization; org create realm-admin only; org switch + session middleware
   allow realm admins for any active org; full `test/features` + `test/ui` run green.
5. [x] UI primitives in `src/ui/authenticated/` + showcase `/demo/admin/ui-kit`.
   (Avatar, Chip, DataTable, EmptyState, OptionCard, ProfileHeader, RelativeTime, SearchField +
   `authenticatedUrlSearchParamWrite`, Skeleton, StatTile, SubNav, Tabs, ActionMenu.)
6. [x] Directory feature: `src/features/directory/{public,server,client,domain,errors}`; client
   `directoryApiClientCreate` (org users list, summary, realm directory list, user access).
7. [x] Set password `PUT /realms/:realmId/users/:userId/password` (`passwordUserTenantSet`), purge
   (`userTenantPurge`, `organizationTenantPurge`), `event_purges` gate, `storageEventsPurge`.
8. [x] Shell + routing (depends 5; uses `/me` contract from 4a): access seam, nav groups, guards, redirects, org
   switcher (realm admins: all orgs), placeholder screens + dispatch + demo routes for all new pages.
8b. [ ] Post-login default destination: owners/admins/realm admins without explicit `return_to` land on
   `/admin/users`.
9. [ ] `scripts/e2eServiceUserEnsure.ts` (system secret: create/activate/verify user, set password via existing
   system password route, grant realm admin via system administrators route) — done together with task 18.

Pages (depend 5,6,8)
10. [ ] Users list (+ service accounts and invitations tabs, invite/create dialogs).
11. [ ] User profile (depends 7 for set password).
12. [ ] Roles.
13. [ ] Projects list + detail tabs.
14. [ ] Configuration (general, branding with live preview, sign-in & security, domains).
15. [ ] Realm group: overview/settings, administrators page.
16. [ ] Remove obsolete admin views, adapters, demo routes, unit tests, e2e specs; `bun run check` green.
16a. [ ] Translate all missing keys into the 14 CSVs; `test/ui/i18n.test.ts` green.

E2E and release
17. [x] Harness `e2e/harness/` + pageerror fixture (all specs import `e2eTest`/`e2eExpect`), unit tests in
    `test/e2eHarness`.
18. [ ] Orchestrator `scripts/e2eRun.ts`, package scripts, dev target server + provisioning (task 9), suite
    registry. Suites are `local` (demo/mocked/self-spawned servers; run against local Vite for both targets) or
    `live` (run against the target: `productionAuthentication`, `productionAccountRegression`, new admin workflows).
18b. [ ] Cleanup (depends 7): stale/own test data purge via service user + verification, stale checkpoint removal.
19. [ ] Workflows `adminOrgOwner`, `adminMemberDenied`.
20. [ ] Workflows `adminOrgAdminLimits`, `adminRealmAdministrator`, `adminInvitations`.
21. [ ] Full `test:e2e:dev` green incl. resume + cleanup verification.
22. [ ] Commit, push, `prodctl deploy authworks`, health check.
23. [ ] Provision production service user, write `.env.production`.
24. [ ] Full `test:e2e` (production) green; verify fresh run, failure/resume, cleanup.

## Current context

- Subagent model: `multisub/muse-spark-1.3-contributor` (the `go/` provider hit its usage limit).
- Dev target: `bun scripts/e2eDevEnvironment.ts start|status|stop` → `http://login.localhost:5190`, state in
  `/tmp/david-opencode/authworks/e2e/dev/` (DB, system secret, `env.json` with service + member credentials).
  Service user `authworks-e2e-service` (realm admin + owner of "Authworks Dev"), member `e2e-dev-member`.
- Open issue: browser discovery sends `window.location.host` incl. port → `/organization-discovery` rejects it.
- Impersonation start does not validate the target (fix in 4b via `realmAdministratorContextAuthorize`).
