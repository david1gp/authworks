# Admin rework — handoff

Date: 2026-10-25. Read with `docs/20261023_admin_rework.md` (the plan: goal, decisions, information architecture,
contracts, E2E design, task list). This file describes the current state and the next steps.

## Goal (unchanged)

Org owners sign in and land on **Users** (sorted by last sign-in). Next to it: **Roles**, **Projects**,
**Configuration** (branding etc.). Clicking a user opens the profile, where owners/admins/realm admins can assign
roles. Realm admins also get a collapsed **Realm** group. Everything is validated by a resumable, self-cleaning E2E
suite: `bun run test:e2e` targets production by default, `bun run test:e2e:dev` targets the dev environment.

User-approved decisions (details in the plan): a real realm-admin role; org owners/admins see only their org's
users; Owner vs Admin split; Realm group in the same sidebar; demo pages kept only for the new screens; same visual
language; deploying to production is allowed; audit events of test data are purged; Contentoren owners are
backfilled as realm admins; old non-admin specs are kept and orchestrated.

## State

- Repo `/home/david/adaptive/authworks`, branch `main` at `9d1a519`, 2 commits ahead of `origin/main` (`c2ca400`).
  All of the admin rework is committed except the work in progress listed below.
- **Production** (`https://authworks.contentoren.de`) runs `4529492`. It was deployed 2026-10-24 18:50 UTC, outside
  this work stream. It already contains most of the rework (backend, pages, e2e harness), but not the later fixes
  (`e3978ee` revert of a dialog refactor, `9d1a519`, the work in progress below). The DB migrations ran on deploy
  (`storageSchemaCreate` runs on startup).
- `~/leo/contentoren-server`: commit `9e9022c` adds the prodctl bridge `authworks-e2e-service-ensure`. It is on
  `origin/main` (someone pushed it) but **not installed on the server**: `~/.local/bin/prodctl` still differs from
  `prodctl/client/prodctl`.
- Dev E2E environment: running (`bun scripts/e2eDevEnvironment.ts status`) at `http://login.localhost:5190`, state
  in `/tmp/david-opencode/authworks/e2e/dev/` (DB, system secret, `env.json` with service and member credentials,
  `server.log`, `checkpoint.json`). `/tmp/opencode` belongs to another user, so the state-dir fallback
  `/tmp/<user>-opencode` is used.
- Scratch files, logs and patches live in `/home/david/adaptive/.authworks-work/`, including i18n tooling in
  `i18n/merge.ts` and `i18n/missingReference.ts`.

### Work in progress (uncommitted, from an interrupted agent)

Goal: make the local suite `task17-advanced` green. It contains `e2e/task17Production.spec.ts`,
`task17CeremoniesProduction.spec.ts`, `task17AdvancedProduction.spec.ts` and `impersonationProduction.spec.ts`;
these spawn their own real server via `e2e/authworksE2eServer*.ts`. 6 tests failed before this work started.

- Spec edits in those 4 files (partial).
- Product fixes. Both look correct; verify and keep them:
  - `src/features/directory/ui/directoryUserProfilePageStateCreate.ts`: the new `mutateVoid` helper. Before it,
    void-result mutations (user delete, realm-admin grant/revoke, session revoke/revoke-all) were treated as
    failures even when they succeeded.
  - `src/features/impersonation/ui/*`: org owners/admins now load impersonation candidates from the org directory
    endpoint, because the realm user list is realm-admin only. Guards are resolved from eligibility before any list
    is loaded.
- Typecheck passes with these changes. Next: run the 4 specs (command under step 1 below), fix what remains, commit.

## E2E status (dev target)

| Suite | Kind | Status |
|---|---|---|
| login (50) | local | ✅ inside a full run |
| account (18) | local | ✅ inside a full run |
| admin-local (66: oidc, machine, impersonation, shells) | local | ✅ alone; not yet inside a full run |
| task17-advanced | local | ❌ work in progress (see above) |
| accessibility (task19 sweeps, demoHub, emailPreview) | local | ❓ not run since the rework; `demoHub.spec.ts` was updated in `1d4d150` |
| productionAuthentication, productionAccountRegression | live | ✅ productionAuthentication; regression not seen in a full run |
| adminOrgOwner, adminMemberDenied, adminOrgAdminLimits, adminRealmAdministrator, adminInvitations (dev only) | live workflows | ✅ each alone with `--only`; resume via fault injection proven on `adminOrgOwner` |

- Unit tests: `test/ui` 522 pass; `test/features`, `test/platform`, `test/cli` were green at the last full run.
- `bun run check` (format, literal-text check, typecheck, all tests, build) has **not** been run on the current
  HEAD. Run it before deploying.

## Next steps (in order)

1. Finish the work in progress:
   `bunx playwright test e2e/task17Production.spec.ts e2e/task17CeremoniesProduction.spec.ts e2e/task17AdvancedProduction.spec.ts e2e/impersonationProduction.spec.ts --reporter=line`.
   Then run the targeted unit tests (`test/ui/impersonation*`, `test/ui/directoryUserProfile*`,
   `test/features/impersonation.test.ts`) and commit.
2. Run the accessibility suite specs locally:
   `bunx playwright test e2e/task19AccountLoginAccessibility.spec.ts e2e/task19LandmarkSweep.spec.ts e2e/demoHub.spec.ts e2e/emailPreview.spec.ts`.
   Fix and commit.
3. Run the full `bun run test:e2e:dev`. It resumes from the checkpoint; use `bun scripts/e2eRun.ts --target dev
   --fresh` for a clean run. It must pass end to end. Then verify:
   - Fresh run and failure/resume, e.g. `AUTHWORKS_E2E_FAIL_AFTER_STEP=users-list` on a full run, then rerun.
   - Cleanup output shows the current run's data removed on success and kept on failure.
4. Run `bun run check`, then commit and push.
5. Back up the production DB (`/home/authworks/.local/share/authworks/authworks.sqlite`) over root SSH
   (`ssh contentoren-server`, a `sqlite3 … ".backup …"` copy). Then `prodctl deploy authworks` from the repo root
   (it deploys committed `HEAD`) and check `/health`.
6. Install the bridge (needs root; approved by the user): in `~/leo/contentoren-server` run
   `./prodctl/deploy.sh apply`. Then confirm `cmp prodctl/client/prodctl ~/.local/bin/prodctl` reports identical
   files; if not, copy the client over.
7. Provision the production service user: `prodctl authworks-e2e-service-ensure`. It writes
   `AUTHWORKS_E2E_SERVICE_USERNAME/PASSWORD` into `/home/david/adaptive/authworks/.env.production` (mode 0600) and
   prints only a status JSON. It runs `scripts/e2eServiceUserEnsure.ts` on the server, so step 5 must come first.
8. Run the full `bun run test:e2e` against production. Verify a fresh run, failure/resume (fault injection) and
   cleanup: production test data must be fully purged (users, organizations, projects and their audit events). Never
   touch anything that doesn't match `^e2e-aw-\d{12}-[a-z0-9]{6}-`, and never the service user.
9. Update the plan (`docs/20261023_admin_rework.md`: tasks 21–24 and "Current context") and run
   `project-registry docs docs/20261023_admin_rework.md`.

## Open issues / decisions to confirm with the user

- `/account` renders without the shell header, so the Admin pill isn't visible there.
- `AuthenticatedActionMenu`: menu items are announced as "close" by assistive technology (corvu `Popover.Close`).
  Specs locate items with `getByRole("menuitem").filter({ hasText })`. Fixing this needs aria-labels on the items.
  Do not change the `AuthenticatedDialog` trigger API: that refactor (`9adc53a`) broke 4 account tests and was
  reverted (`e3978ee`).
- Authorization widened to unblock org owners (confirm with the user):
  - `GET /realms/:realmId/organization-roles` (static definitions) is readable by any signed-in user of the realm.
  - The realm default login policy and the org-scoped external identity providers are readable by an org's
    owners/admins.
- The coarse route guard `permission` is `"granted"` for every signed-in user. The real gate is the per-screen
  `access` (`organization-admin` / `realm-admin`) plus the backend.
- The ">24 h old" branch of cleanup is covered only by a unit test, because dev data is never that old.
- Old stashes `stash@{0..5}` exist; `stash@{0}` (02:23) came from an agent's accident and is already restored.
  Leave them, or let the user decide. The worktrees `/home/david/adaptive/.authworks-work/wt-base` (1bb6b27,
  pre-rework baseline) and `wt-head` can be removed with `git worktree remove`.

## Key locations

- Plan: `docs/20261023_admin_rework.md`. Code style: the `code-style` skill. Repo rules: `AGENTS.md` (Bun, Biome,
  tests with max concurrency 1).
- New admin UI:
  - Users, user profile, roles and realm administrators: `src/features/directory/ui/` (backend in
    `src/features/directory/{public,server,client}`).
  - Projects: `src/features/projects/ui/ProjectDetail*`.
  - Configuration: `src/features/organizations/ui/OrganizationConfiguration*`.
  - Realm: `src/features/admin/ui/AdminRealmView.tsx`.
  - Shell, routes and access seam: `src/ui/production/` (`productionRouteContractMap.ts`,
    `productionShellNavigationGroups.ts`, `productionShellAccessResolve.ts`, `ProductionRouteApp.tsx`).
  - Primitives: `src/ui/authenticated/` (showcase at `/demo/admin/ui-kit`).
- Production routes render through the catch-all `/admin/*adminPath`, so `useParams()` is empty there. Screens must
  receive params via `props.state.routeParam(...)` from `ProductionRouteApp.tsx`.
- Authorization:
  - `src/features/realms/actions/realmAdministratorContextAuthorize.ts`.
  - The `realm_administrators` table and `src/features/realms/server/realmAdministratorIs.ts`.
  - Fixed roles in `src/features/authorization/domain/authorizationFixedRoleDefinitions.ts`.
- Purge: `src/platform/storage/storageEventsPurge.ts` (the `event_purges` gate), `userPurge`, `organizationPurge`.
- E2E:
  - Orchestrator `scripts/e2eRun.ts` (checkpoint, per-target run lock, cleanup in `finally`, dev server stopped only
    by the run that started it).
  - Harness `e2e/harness/`: suite registry `e2eSuiteRegistryList.ts`, cleanup `e2eCleanupRun.ts` and
    `e2eCleanupSelect.ts`, service API client `e2eServiceApiClientCreate.ts`, credentials
    `e2eCredentialsResolve.ts`, dev env `e2eDevEnvironmentEnsure.ts`.
  - Workflows `e2e/workflows/<name>/` (one file per step).
  - Service-user script `scripts/e2eServiceUserEnsure.ts`; dev env `scripts/e2eDevEnvironment.ts`.
- i18n: English in `src/ui/i18n/model/englishCatalog.ts`, translations in `public/i18n/*.csv` (14 locales, strict
  CSV quoting). `test/ui/i18n.test.ts` requires every key in every locale.

## Lessons for the next orchestrator

- Subagents (Muse Spark contributor) often end their turn on a narration line. Resume them with "tool calls only,
  one final report". Fresh, narrowly scoped agents work better than long sessions.
- Subagents repeatedly ran `git stash` / `stash apply` / reverts despite instructions and lost other agents' work.
  Commit at milestones yourself, keep rsync backups (`/tmp/david-opencode/backups/`, but `/tmp` was wiped once),
  and check `git status`, `git stash list` and `git ls-files -u` after each agent.
- Only one orchestrator run at a time per target (the run lock enforces this). The shared dev server must not be
  restarted while another agent is running against it.
