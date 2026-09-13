# Direct project user assignments

## Goal
Support assigning users directly to projects through the library and CLI, with membership-only assignments or optional project roles.

## Decisions
- Extend the architecture in `docs/20260817_authworks.md`; preserve organization grants.
- Store direct project memberships separately, unique per project and user, scoped to a realm.
- Omitted or empty role keys mean membership only and confer no role-derived permissions.
- Validate users and project roles using existing feature surfaces and conventions.
- Existing project administrators manage assignments; assignment alone does not grant management authority.
- Use existing dependencies, public contract patterns, transactions, events, and CLI naming conventions. No UI changes.

## Approach
Implement project-owned persistence and actions first, then access evaluation, HTTP/library contracts, and CLI. Cover each increment with focused tests. Follow repository single-concurrency test rules and run `bun run check` before completion.

## Tasks
1. Completed: Add direct assignment persistence, public schemas, transactional create/list/update/remove actions, and focused tests for membership, roles, validation, isolation, and events. Assignment management and listing require `project.write`; create defaults roles to empty, update preserves omitted roles, and removal is idempotent.
2. Completed: Integrate direct assignments into project access checks and effective account access, with focused authorization tests. Direct membership supplies project read access and a `project-assignment` effective-access source; role-derived access excludes management permissions.
3. Completed: Expose assignment operations through authenticated routes and the project library client, with contract tests. Routes use `/projects/:projectId/assignments`; client methods use `projectUserAssignmentCreate/List/Update/Remove` and tenant counterparts.
4. Completed: Add CLI assignment commands with optional roles and focused tests. Commands are `projects assignment-create/list/update/remove`; omitted roles create membership-only and `--role-keys ""` clears roles on update.
5. Completed: Run repository checks and review the completed surfaces.
