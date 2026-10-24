# Relying-party access + migrated numeric project IDs

Status: in progress

## Goal

1. Let OIDC clients link to projects imported from Zitadel with numeric IDs (e.g. `381760977282007057`),
   so `urn:zitadel:iam:org:project:roles` is emitted again.
2. Give relying parties (first consumer: assets-service) one endpoint for the signed-in user's full
   organization memberships and project roles across every project — without touching the
   resource-owner claim semantics other apps depend on.

## Decisions

1. Reuse `projectResourceIdSchema` from the projects public surface for all three OIDC `projectId`
   fields (create request, update request, client schema). No copy.
2. Keep `applicationId` as UUIDv7-only: the Zitadel importer always mints applications and OIDC
   clients with `randomUUID()` (`zitadelMigrationImport.ts` `importOidcApplication`: `destinationId`,
   `existingClient?.id ?? randomUUID()`); only projects reference the foreign numeric `input.projectId`
   via the source-record mapping. Numeric project IDs reach the DB through the project mapping
   `destinationId ?? input.projectId` fallback in role/grant/application importers.
3. Factor the userinfo token/session/user/client validation into one helper used by both userinfo
   and the new `oidcMeAccessGet` action; userinfo behavior stays byte-identical.
4. `GET /oauth2/me/access` (public OIDC host, realm from host like userinfo). Trusted clients only
   (403 `insufficient_scope` otherwise). Invalid/expired token, revoked session, deleted user map to
   401 `invalid_token` with `WWW-Authenticate: Bearer error="invalid_token"`, mirroring userinfo.
5. Response shape mirrors access-token role claims but flattened across all ACTIVE realm projects via
   the existing `projectSubjectProjectRoleResolve` server helper; projects resolving to
   `projects.not-found` (missing/inactive) are skipped. Sorted by (projectId, organizationId).
   Organizations come from `organizationSubjectMembershipList` (active orgs only) plus org name and
   primary domain; project roles carry no domain (unlike the token claim).
6. Typed client method `oidcMeAccessGet(accessToken)` on `oidcApiClientCreate`, following the
   `oidcUserInfoGet` pattern (bearer token passed per call, not via client options).

## Checklist

- [x] Feature 1: `projectId` in the three OIDC schemas accepts numeric IDs via projects surface
- [x] Feature 1: schema tests (numeric + UUIDv7 accepted, garbage rejected)
- [x] Feature 1: action test — update client to numeric project id, round-trip through get/list
- [x] Feature 1: token-issue test — role claim emitted for numeric-ID project with assertion on
- [x] Feature 1: CLI `--project-id` on client-create/client-update, `--clear-project-id` on update
- [x] Feature 1: CLI flag tests
- [x] Feature 1: verify no other validators (persistence mapping, public view, admin UI, typed client)
- [ ] Feature 2: public `oidcMeAccessResponseSchema` + public index export
- [ ] Feature 2: shared access-token context helper, userinfo unchanged
- [ ] Feature 2: `oidcMeAccessGet` action (trusted-only, active orgs/projects)
- [ ] Feature 2: `GET /oauth2/me/access` route + typed client method
- [ ] Feature 2: endpoint tests (direct, grant-based, multi-org, no-role project omitted,
      untrusted 403, expired/revoked token 401, revoked session 401, deleted user 401)
- [ ] `bun run check` green; conventional commits; final summary
