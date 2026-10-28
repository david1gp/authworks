# Application experience audit

## Goal

Deliver working, coherent, pleasant production experiences for sign-in and registration, personal account management, organization invitations, organization administration, and IAM administration. Add discoverable recent administrative activity. Preserve the feature architecture and the capabilities defined in `docs/20260817_authworks.md`.

## Decisions

- Work in the isolated temporary Git worktree based on `main`; do not alter the original checkout until integration.
- Use Bun, existing dependencies, the code-style skill, feature-owned modules, explicit `.js` imports, and repository-managed development services.
- Fix reproducible functional, authorization, accessibility, and navigation defects before cosmetic improvements. Avoid unrelated redesigns and broad code-style churn.
- Preserve organization invitations under Users → Invitations. Make sign-in/registration and invitation return journeys actionable and safe.
- Recent activity means administrative activity relevant to the selected organization or IAM context, not a relabeled personal security history. Reuse existing authorized event contracts where possible and do not disclose secrets or cross-tenant events.
- Perform focused unit/integration checks per change, with test concurrency one. Defer comprehensive checks and browser/E2E verification until changes are assembled. After failures, rerun only failing files/tests before the final verification gate.
- Use only test-owned resources and the isolated managed preview. Do not modify production accounts or restart production services.

## Tasks

1. **Audit and scope** — Trace production flows, review UI/navigation and authorization, inspect existing test coverage, and exercise the isolated preview. Status: complete.
2. **Authentication and account journeys** — Correct confirmed login/registration/return-path/profile/security defects, including actionable anonymous account entry; cover the resulting behavior with focused tests. Status: implementation complete; integrated verification pending.
3. **Invitations and administrative contexts** — Correct confirmed invitation lifecycle and organization/IAM navigation or authorization defects without widening access. Status: implementation complete; real acceptance/decline verified and IAM detail correction independently reviewed, final workflow verification pending.
4. **Administrative recent activity** — Add a dedicated, discoverable activity page using correctly authorized, scoped event data, with useful loading/empty/error states, readable event details and focused tests. Status: implementation complete; integrated verification pending.
5. **Experience polish and independent review** — Resolve confirmed responsive/accessibility/usability defects in the affected surfaces; independently review changes for correctness, security and code-style. Status: complete; any integrated verification defects remain part of task 6.
6. **Verify and integrate** — Run `bun run check`, production-flow E2E and browser verification against the managed dev/preview; address failures, follow `/commits`, integrate into `main`, push, verify the integrated result, and remove only this task's worktree/state/server resources. Status: implementation, commits, main integration, post-merge verification and cleanup complete; final push next.

## Current context

- The verified audit commits are integrated into `main` at `/home/david/adaptive/authworks`; the main tree matches the verified implementation.
- Post-merge verification is complete. All task-owned preview servers, development state, worktrees, recovery snapshots and temporary artifacts have been removed; only the original main checkout remains.
- Source and live-browser audits established the next changes: usable invitation URLs, accurate account access messaging, recognizable organization member identities, and administrative activity discoverability.
- Existing realm event list/export contracts already provide authorized, redacted IAM audit data. Organization-admin activity must retain explicit organization scoping and authorization.
- Sign-in entry now has an actionable fallback; explicit return destinations remain validated and role-aware default routing remains intact.
- Directory follow-up covers reactive organization context, stale-request rejection, and explicit service-account/invitation load-error states.
- Account follow-up covers truthful access messaging, visible organization-load failures, accessible organization panels, and permission-aware administration/continuation links.
- Configuration follow-up retains domain-claim form state until successful completion. Shared URL navigation will use navigation semantics rather than incomplete ARIA tabs.
- Organization activity will use a separate, protected organization-scoped list endpoint with existing event response/pagination conventions. It must select only events whose ownership can be established explicitly and must never post-filter a realm-wide response in the browser.
- Organization activity authorization is available through the organizations feature's explicit server surface. Ownership checks stay with organization-owned persistence and constrain event queries before pagination; ambiguous historical rows are omitted.
- Registration must carry a validated local continuation through the verification email and subsequent sign-in, including when the email is opened in a separate tab/browser.
- Organization activity includes provably owned organization, invitation, membership and project-creation events. Domain ownership is not inferred from reassigned current records; ambiguous history is excluded.
- Account provides authorized administration navigation and explicit invitation completion/invalid-link continuations; organization members have recognizable identities.
- Activity is a top-level administrative destination with explicit organization/IAM context, cursor navigation, readable summaries and safe expandable details. The existing IAM audit log remains available separately.
- Final verification targets the isolated managed dev environment only, including production-mode and demo E2E groups; production accounts/services are outside the audit's runtime mutations.
- Registration continuation, reactive directory context and bounded organization activity queries are implemented. The final context distinction prevents failed organization discovery from silently becoming IAM scope.
- Independent reviews are complete. Final verification includes strengthening invitation authentication/continuation and scoped-activity browser assertions before integration.
- Directory context isolation also protects delayed invitation-revoke confirmations: a confirmation from a previous organization cannot mutate its target after the selection changes.
- Local browser suites support explicit isolated ports, preventing an unrelated development server from being reused as audit verification. All local E2E workers remain serial within their suite.
- Real invitation acceptance creates the intended membership, decline creates none, and completion links reach account access. Invitation review now includes the recognizable organization name.
- Added catalog messages are translated across all supported locales; schema-aware membership validation retains the CLI's closed failure contracts.
- Verification uses isolated per-suite development ports and task-owned artifacts. Heavy process-contract tests and browser suites will be sequenced for the final gate to avoid resource-contention timeouts.
- IAM resource access now permits verified in-realm administrators to manage an organization without switching into it or granting themselves membership; ordinary user context binding, cross-realm restrictions, CSRF and MFA checks remain intact.
- Account regression assertions match the accessible panel and profile presentation, and decorative avatar content no longer conflicts with the identity menu's accessible name.
- Remaining work is final verification and integration; completed suites are not repeated except for focused failures or the final gate.
- Live organization-owner, ordinary-member restrictions, organization-admin limits, IAM administration and invitation workflows are verified, including organization-scoped recent activity and sign-out.
- The integrated source has completed the full check, critical production-flow verification and fresh post-merge authentication, account, organization-owner, IAM, invitation and member-restriction workflows.

## Acceptance

- Anonymous protected-page entry offers a safe route to sign-in and back; login/registration lead to appropriate user/admin contexts.
- An administrator can invite, inspect and revoke invitations; the intended invitee can authenticate/register, inspect, accept or decline, and receive the expected access without crossing tenant or identity boundaries.
- Ordinary users can manage their own profile/security/access; administrative controls and IAM context remain correctly permission-gated.
- Administrators can find and understand recent activity for their authorized scope, with safe event data and useful feedback states.
- Changed TypeScript follows project code-style; checks and relevant production browser/E2E journeys pass.
- Changes are committed, integrated into `main`, pushed, and task-owned temporary resources are cleaned up.
