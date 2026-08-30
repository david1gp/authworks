# Account organization tabs

## Goal

Make the `/account` Access section useful for users with multiple organizations by letting them inspect each membership and its effective access without changing or reloading user-scoped profile data.

## Decisions

- Keep `/account` as one workspace and place the organization selector inside the existing Access section; do not add account subroutes or another top-level navigation row.
- Treat the selected tab as the organization being viewed, independently from the active organization stored in the session. Selecting a tab never switches context automatically.
- Mark the active organization clearly and provide one explicit **Make active organization** action in the selected organization's panel when it is not active. Continue to use the existing switch action and session context.
- Use accessible organization tabs for small membership sets and a native select for more than eight organizations. Preserve keyboard navigation, selected/active semantics, and a usable horizontally scrollable mobile layout.
- Show only existing member-visible, organization-specific data in the first scope: organization identity and status, membership status and roles, organization-level effective permissions, and accessible projects with their roles, grants, and effective permissions.
- Filter the existing self-service organization and effective-access responses by the viewed organization. Do not require switching merely to inspect access, and do not introduce an administrator endpoint.
- Keep personal profile, credentials, MFA enrollment, passkeys, sessions, and security history outside the organization selector because they remain user-scoped.
- Do not show organization-wide MFA/login policy, member directories, full project inventory, branding, domains, or role policy configuration until an explicit member-readable contract and authorization boundary exists.
- Replace the current repeated organization cards and separate unscoped effective-access presentation with one selected-organization detail panel; keep loading, empty, error, retry, mutation notice, and stale-response protections.
- Reuse the existing SolidJS, authenticated UI, button, i18n, API-client, and schema patterns; add no dependency and expose no persistence row as a public contract.
- This plan supplements the completed organization/account work in `docs/20260817_authworks.md`, `docs/20260829_account_workspace.md`, and `docs/20260830_account_workspace_wide_layout.md`.

## Approach

- Add a local viewed-organization state to the account access state. Initialize it from the active organization, retain a valid explicit selection, follow an external active-organization change, and fall back safely when memberships change.
- Derive the selected membership and its organization/project access groups from the already loaded `/me/organizations` and `/me/effective-access` data rather than adding a backend endpoint.
- Split the organization selector and selected detail panel into focused account UI views, keeping interaction/state logic out of TSX and preserving feature ownership under `src/features/account/ui`.
- Wire production and demo adapters to the same view contract and route activation through the existing organization switch behavior.
- Update localized copy and focused state, interaction, API-regression, and browser tests, including narrow and wide layouts and two organizations with distinct access.

## Tasks

- [x] 1. Extend account access state with independent viewed-organization selection and selectors that group existing membership and effective-access data by organization, including active-context synchronization and membership-removal fallbacks.
- [x] 2. Build the accessible responsive organization tab/select control and selected-organization detail panel with active status, explicit activation, membership roles/status, effective permissions, and accessible project/grant details.
- [x] 3. Integrate the selector and detail panel into the Access section in production and demo compositions, replacing duplicate organization cards and the separate all-organization access presentation while preserving existing boundaries and notices.
- [x] 4. Add localized labels and focused tests for tab keyboard behavior, viewed-versus-active semantics, external switching, failed switching, filtering, loading/error/empty states, and stable user-scoped profile state.
- [x] 5. Update production browser coverage for small and large organization sets, mobile and desktop behavior, distinct per-organization content, explicit activation, and no duplicate top-level account navigation; run `bun run check`.
