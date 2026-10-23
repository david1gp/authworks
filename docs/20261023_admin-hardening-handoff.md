# Admin hardening handoff — org-scoped machine users follow-up

Date: 2026-10-23. Status: implement the four items below, in order.

## 1. Machine-user target-org check

Why: machine-user rows are org-scoped since the migration
(`organizationId` non-null, unique per `(organizationId, userName)` in
`src/features/machineUsers/persistence/machineUserTable.ts`), but the
human-actor path in
`src/features/machineUsers/actions/machineUserContextAuthorize.ts` (lines
38-47) authorizes through `realmAdministratorContextAuthorize` with no target
scoping. Any admin of org A can manage org B's machine users.

How: apply the shared-org rule already implemented in
`src/features/realms/actions/realmAdministratorContextAuthorize.ts`.
Preferred shape: add an optional `targetOrganizationId` to that function,
mirroring the existing `targetUserId` flow (lines 53-62, 73-79) — resolve the
target org set to the single org, then require the actor to hold an active
owner/admin membership in it via `organizationMembershipAccessList`. Keep the
`bootstrap_admin` and `system` bypasses exactly as they are. The machine-actor
path (lines 48-53, `authorizationEnforce` with `organizationId`) is already
org-bound; do not touch it. The no-escalation-via-scopes analysis still holds
(scopes are a free-form consumer vocabulary, machine actors never pass the
session middleware), so this closes cross-org administration, not privilege
escalation.

Acceptance: admin of A gets 403/not-found on create/list/get/revoke/secret
operations in B, full access in own org; bootstrap and system contexts
unaffected. Extend
`src/features/machineUsers/actions/machineUserOrganizationIsolation.test.ts`.

## 2. Realm-update MFA step-up

Why: `PATCH /realms/:realmId` runs under `realmWriteMiddleware` in
`src/features/realms/server/realmServerAppCreate.ts` (lines 48-52), which sets
no `minimumAssurance` — single-factor realm reconfiguration by any org admin.

How: follow the existing pattern in
`src/features/passwords/server/passwordServerAppCreate.ts` (lines 83-85):
pass `minimumAssurance: "multi_factor"` so the write middleware and the
`realmAdministratorContextAuthorize` call both enforce it.

Bootstrap caveat (must handle): `realmAdministratorContextAuthorize` enforces
`minimumAssurance` against `bootstrap_admin` actors too (lines 31-39). Verify
what assurance a bootstrap session carries during first setup; if it cannot be
`multi_factor`, exempt `bootstrap_admin` from the step-up (first-setup must
not brick) while enforcing it for all `user` actors. Cover both cases in
tests.

## 3. Remaining MFA step-ups

Why: destructive and credential-issuing writes should match the protection
already on password/MFA-policy and IdP writes.

Scope (each: add `minimumAssurance: "multi_factor"` at the route's authorize
call, same pattern as §2, honoring the bootstrap caveat):

- User delete and lifecycle/verification writes in
  `src/features/users/server/userServerAppCreate.ts` (routes near lines
  194-251, 587-721; actions `userDelete.ts`, `userLifecycleSet.ts`).
- Machine credential issue/revoke and secret rotation in
  `src/features/machineUsers/server/machineUserServerAppCreate.ts` (actions
  `machineCredentialIssue.ts`, `machineCredentialRevoke.ts`,
  `machineUserClientSecretRotate.ts`, `machineApiKeyCreate.ts`,
  `machinePersonalAccessTokenCreate.ts`).
- Realm/org login-policy set routes (realm-level policy is global).
- Session revoke (`sessionAdministratorRevoke.ts`,
  `sessionRevokeAll.ts`) only after confirming MFA-enrolled admins can act
  under incident pressure — this is response tooling, so verify the flow with
  a break-glass account rather than assuming. Reads stay single-factor
  everywhere.

## 4. User-list directory scoping

Why: `userList` (`src/features/users/actions/userList.ts`) returns every
realm user with email plus phone to any org admin — cross-org PII
enumeration. Per-user reads are already shared-org-scoped; the list is the
remaining hole.

How: filter result rows to users sharing an active org where the actor holds
an active owner/admin membership, reusing `organizationMembershipAccessList`
and the target-org pattern from §1. Keep user creation global (it grants no
org access). Preserve system-context behavior and pagination semantics;
document any count shifts. Add a colocated list-isolation test beside the
users feature.

## 5. Verification and repo rules

- Tests live beside the feature they exercise; extend existing isolation
  suites before adding new files.
- Strict ESM TypeScript with relative `.js` specifiers; Biome format/lint;
  feature code under `src/features/<feature>`, no feature behavior in
  `src/outputs/*`, no direct SQLite outside repositories.
- Run `bun run check` before finishing; run tests with max concurrency 1,
  and on failure re-run only the failing file/test.
- Do not push or deploy without being asked; leave the work committed or
  uncommitted per the requester's instruction at handoff time.
