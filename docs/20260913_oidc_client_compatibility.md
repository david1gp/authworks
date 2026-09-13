# OIDC client compatibility settings

## Goal

Support configurable ID-token UserInfo claims, project-role access-token claims, and additional browser origins through
the API, library, CLI, and existing client administration UI, including ZITADEL migration.

## Decisions

- Settings belong to individual OIDC clients and default to disabled or empty.
- Preserve scope and consent boundaries for personal claims and existing project/realm authorization for roles.
- Verify ZITADEL claim and origin semantics before implementing compatibility mappings.
- Use existing feature public surfaces, libraries, and UI patterns. Do not modify production services.
- Keep unrelated ZITADEL settings explicitly unsupported.
- Role assertions use the ZITADEL role-to-organization claim structure. Effective browser origins combine redirect-URI
  origins with explicitly configured additional origins; matching is exact.

## Approach

- Extend client contracts, persistence, and administration surfaces first.
- Implement token behavior and protocol CORS independently using the stored settings.
- Expose configuration in existing CLI and UI, then map migration fields and verify end to end.

## Tasks

- [x] 1. Confirm exact claim/CORS semantics and add settings to persistence, API, and library contracts with tests.
- [x] 2. Implement scoped ID-token UserInfo assertion with token-flow tests.
- [x] 3. Implement project-role access-token assertions with authorization/isolation tests.
- [x] 4. Implement client-associated OIDC CORS handling with preflight and origin tests.
- [x] 5. Add CLI create/update/read configuration support and tests.
- [x] 6. Add visible, editable settings to existing web UI and verify with a browser.
- [x] 7. Map ZITADEL snapshot export/import settings and verify convergence.
- [x] 8. Run repository checks and review the complete feature across public surfaces.
