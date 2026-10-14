# Shared Convex OIDC clients and CLI authorization diagnostics

## Goal and scope

Provide one shared Zitadel client/secret and one shared Authworks client/secret for the Convex apps on Leo during migration testing. Secret bytes are not shared between providers. Keep existing app registrations, running login configurations, and role mappings unchanged; application ports and live cutovers are separate work.

Also complete the original Authworks OIDC CLI credential-type error fix. `docs/20260817_authworks.md` remains authoritative for repository boundaries; this is a narrow follow-up.

## Decisions

- Stage shared credentials through `/home/david/leo_internal/dev-servers` and its managed SSH/executor conventions. Store real credentials only in ignored private state and mode-0600 files, never docs, reports, logs, or committed samples.
- Managed entrypoints: `leo:shared:oidc:setup` creates/reconciles and captures shared clients; `leo:shared:oidc:push` stages existing protected state. `leo:authworks:cli:update:push` activates the Authworks-only updater remotely as Leo; the unsuffixed updater is local-only.
- Register exact verified callbacks for the actual non-benchmark Convex apps. Use existing callback routes where confirmed, plus CRM/Multichat's existing Authworks routes. Do not invent routes for unported apps or Google-only Akademie; record their readiness separately.
- A confidential shared client supports server-side authorization-code exchanges. Multichat's public PKCE exchange needs an application port before using it. Never put the shared secret in browser/public env variables.
- A client belongs to one project. Shared clients do not automatically preserve separate project-role claims. Do not migrate role assignments or grant permissions in this task.
- Keep Authworks password-login failures enumeration-resistant. Operator guidance explains nonportable Zitadel passwords and distinguishes credential lookup from password provisioning.
- Preserve valid existing secrets. New shared clients hand off their generated secrets once; repeat ensure operations do not rotate or reveal them. If private state is missing for an existing shared client, fail with recovery guidance rather than silently rotate.
- The setup runner never performs automatic secret recovery. If this task's newly created, unused migration client's initial handoff is lost, use a separately identified operator recovery for that exact client only, retain the replacement in protected durable state before transport, and leave all pre-existing app credentials unchanged.
- Match the Authworks migration client only by its exact shared name. Callback overlap with old app clients is expected and permitted; do not adopt, mutate, or reject those old registrations.
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

1. **CLI diagnostics and password operator guidance — complete**
   - Resolve OIDC system credentials only from `--system-token` or `AUTHWORKS_SYSTEM_SECRET`, never `--token`/saved user bearer.
   - Fail before API I/O with actionable credential-type guidance; clarify help and preserve redaction.
   - Preserve logout and existing fixed-purpose commands; align focused profile tests.
2. **Callback catalog and staged dev-server configuration — complete**
   - Build a small explicit public callback/readiness catalog from verified env and source evidence. Resolve uncertain callbacks with bounded inspection, not guessed URLs.
   - Add a dedicated shared-OIDC setup/push entrypoint, private ignored credential state, safe samples/docs, and focused tests.
   - Stage shared credentials to a protected common config on Leo without rewriting app envs, uploading Convex env, or switching providers.
3. **Authworks fixed shared ensure — complete**
   - Reuse existing fixed production ensure patterns for the shared name, exact callback catalog, scopes, flags, realm resolution, create/reconcile and one-time handoff.
   - Compose the zero-argument CLI command and cover payload, idempotency, restricted inputs, failures, redaction and handoff with focused tests.
4. **Production broker and Zitadel shared registration — complete**
   - Retarget the undeployed CRM root scaffold to the fixed shared Authworks command; update explicit dispatch/install/sudo allowlisting and focused root/handoff tests.
   - Use existing Zitadel CLI/management authorization to create/reconcile the migration project/client without changing old apps, users or role assignments. Capture its new secret into private state without output.
   - Complete only the machine handoff needed by the dev-server entrypoint. Default human invocation must not print/discard a new secret.
5. **Integration and managed activation — complete**
   - Run narrow changed-file tests with concurrency 1 first; run required Authworks `bun run check` after feature integration. After failures, rerun only the failing test/file.
   - Run repository-required narrow infra checks; independently review credential boundaries.
   - Commit tested changes and activate via existing managed deployment/push scripts, without package-release workflows or unrelated e2e.
   - Verify client policies, staged-file permissions and repeated setup with no rotation or app-env change. Never print credentials.

## Current context

The migration-testing setup is active and complete. Both fixed-name clients are registered and their actual policies match the intended catalogs. Credentials are held in ignored private state and staged to Leo's protected common config. Repeat setup made zero changes. The managed Authworks service, restricted broker and Leo's updated CLI are active; the credential-type diagnostic is verified on Leo. All 20 application envs, existing registrations, roles and passwords remain unchanged. Application ports and live cutovers are separate work.

The callback catalogs contain 20 Zitadel and 19 Authworks entries. Use the shared setup/push scripts and documented protected-state recovery; never display credentials or manually handle the Authworks system secret.
