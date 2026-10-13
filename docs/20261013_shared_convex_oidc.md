# Shared Convex OIDC clients and CLI authorization diagnostics

## Goal and scope

Provide one shared Zitadel client/secret and one shared Authworks client/secret for the Convex apps on Leo during migration testing. Secret bytes are not shared between providers. Keep existing app registrations, running login configurations, and role mappings unchanged; application ports and live cutovers are separate work.

Also complete the original Authworks OIDC CLI credential-type error fix. `docs/20260817_authworks.md` remains authoritative for repository boundaries; this is a narrow follow-up.

## Decisions

- Stage shared credentials through `/home/david/leo_internal/dev-servers` and its managed SSH/executor conventions. Store real credentials only in ignored private state and mode-0600 files, never docs, reports, logs, or committed samples.
- Register exact verified callbacks for the actual non-benchmark Convex apps. Use existing callback routes where confirmed, plus CRM/Multichat's existing Authworks routes. Do not invent routes for unported apps or Google-only Akademie; record their readiness separately.
- A confidential shared client supports server-side authorization-code exchanges. Multichat's public PKCE exchange needs an application port before using it. Never put the shared secret in browser/public env variables.
- A client belongs to one project. Shared clients do not automatically preserve separate project-role claims. Do not migrate role assignments or grant permissions in this task.
- Keep Authworks password-login failures enumeration-resistant. Operator guidance explains nonportable Zitadel passwords and distinguishes credential lookup from password provisioning.
- Preserve valid existing secrets. New shared clients hand off their generated secrets once; repeat ensure operations do not rotate or reveal them. If private state is missing for an existing shared client, fail with recovery guidance rather than silently rotate.
- Use existing dependencies, feature-owned Authworks code, fixed privileged broker commands, committed-source managed deployment, and trusted repository-pinned SSH routes. Do not add a generic tenant CLI or distribute `AUTHWORKS_SYSTEM_SECRET` to Leo.

## Shared client policy

- Name: `Leo Convex apps (migration testing)` in each provider.
- Confidential web client; authorization code with PKCE supported; trusted/no consent where the existing provider supports these settings; ID-token userinfo assertion enabled.
- Standard scope catalog: `openid`, `profile`, `email`, `offline_access`, `urn:zitadel:iam:user:resourceowner`. No Microsoft/Google-specific scopes or automatic project-role assertion.
- Authworks production origin `https://authworks.contentoren.de`; production realm resolved through its domain; system credential read only through the protected existing production service environment.
- Zitadel origin/profile `https://auth.contentoren.de` / `contentoren`; use existing supported management tooling and an explicit migration-testing project, not an arbitrary app's existing project.
- Fixed Authworks CLI: `authworks oidc leo-convex-production-ensure` with no caller-controlled policy, origin, realm, token, or callback flags.
- Creation handoff: one JSON line containing exactly `clientId`, `clientSecret`, `kind: "authworks.leo-convex-production-oidc-credential"`, `version: 1`; no stdout handoff on existing/reconciled clients.
- Fixed broker: `authworks-leo-convex-production-ensure`. Retarget the undeployed CRM-only root scaffold to this shared primitive; do not leave an unsupported CRM broker command deployed.

## Tasks

1. **CLI diagnostics and password operator guidance — implemented; integration verification pending**
   - Resolve OIDC system credentials only from `--system-token` or `AUTHWORKS_SYSTEM_SECRET`, never `--token`/saved user bearer.
   - Fail before API I/O with actionable credential-type guidance; clarify help and preserve redaction.
   - Preserve logout and existing fixed-purpose commands; align focused profile tests.
2. **Callback catalog and staged dev-server configuration — catalog, private-state helper and protected push implemented; integration review in progress**
   - Build a small explicit public callback/readiness catalog from verified env and source evidence. Resolve uncertain callbacks with bounded inspection, not guessed URLs.
   - Add a dedicated shared-OIDC setup/push entrypoint, private ignored credential state, safe samples/docs, and focused tests.
   - Stage shared credentials to a protected common config on Leo without rewriting app envs, uploading Convex env, or switching providers.
3. **Authworks fixed shared ensure — implemented; callback synchronization and policy review in progress**
   - Reuse existing fixed production ensure patterns for the shared name, exact callback catalog, scopes, flags, realm resolution, create/reconcile and one-time handoff.
   - Compose the zero-argument CLI command and cover payload, idempotency, restricted inputs, failures, redaction and handoff with focused tests.
4. **Production broker and Zitadel shared registration — root/client handoff implemented; Zitadel helper schema alignment in progress**
   - Retarget the undeployed CRM root scaffold to the fixed shared Authworks command; update explicit dispatch/install/sudo allowlisting and focused root/handoff tests.
   - Use existing Zitadel CLI/management authorization to create/reconcile the migration project/client without changing old apps, users or role assignments. Capture its new secret into private state without output.
   - Complete only the machine handoff needed by the dev-server entrypoint. Default human invocation must not print/discard a new secret.
5. **Integration and managed activation — focused Leo updater in progress; setup coordinator pending**
   - Run narrow changed-file tests with concurrency 1 first; run required Authworks `bun run check` after feature integration. After failures, rerun only the failing test/file.
   - Run repository-required narrow infra checks; independently review credential boundaries.
   - Commit tested changes and activate via existing managed deployment/push scripts, without package-release workflows or unrelated e2e.
   - Verify client policies, staged-file permissions and repeated setup with no rotation or app-env change. Never print credentials.

## Current context

The chosen increment is migration-testing setup, with app ports/live cutovers separate. Authworks diagnostics, fixed shared ensure, root/client handoff, dev-server catalog/private-state reader/protected push are implemented but not deployed. Shared state is `leo-server/shared_oidc/private/credentials.env`; remote staging targets `~/.config/contentoren/convex-oidc.env`. Canonical Zitadel organization ID is `380716752838852623`, and cached contentoren management authorization is available. Its helper must use decimal IDs, organization-scoped project matching and the real `oidcConfiguration` response field before provisioning. Callback synchronization, independent boundary reviews and the Authworks-only managed updater are in progress. Next add a thin setup coordinator with durable private capture of each new one-time secret before the next provisioning step, then integrate and activate. Existing CRM credentials and all working app configurations must remain unchanged.
