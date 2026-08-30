# Account workspace wide layout

## Goal

Make `/account` easier to navigate and share, use wide desktop screens effectively, present related account data in clear side-by-side cards, keep user-scoped profile state stable while switching organizations, and restore WhatsApp phone-number enrollment.

## Decisions

- Give every account workspace section a stable anchor target and clickable permalink affordance.
- Keep Profile, Security, Sessions and devices, Access, and Danger zone in the primary navbar row; remove the duplicate secondary account navigation row.
- Use a wider responsive workspace container while preserving a single-column mobile layout.
- Place profile information and a standalone profile-picture card side by side on desktop, with no redundant native-looking file-choice control.
- For WhatsApp phone numbers, email verification, passkeys, authenticators, and external accounts, show existing entries in a left card and add/enroll controls in a right card.
- Show sessions/devices and applications side by side on desktop.
- Show organization, project, role, and permission access as cards. Put each access source's permission list in a collapsed `details` disclosure by default.
- Put the entire Danger zone content in a collapsed `details` disclosure by default.
- Treat profile data as user-scoped: organization switching must update organization-scoped context without discarding or re-fetching stable profile state.
- Diagnose the observed phone-change challenge failure from the actual client/server result, fix the smallest responsible layer, and retain E.164 validation.
- Reuse existing package libraries and UI patterns; do not add a new dependency unless the existing stack cannot meet a requirement.

## Approach

- Refactor the account workspace and global authenticated navigation without changing feature ownership or public account contracts unnecessarily.
- Extract or adjust reusable card, anchor-heading, and disclosure presentation only where repeated account sections need them.
- Preserve independently loaded account state and refresh only organization-scoped sections after an in-app organization switch.
- Reproduce the WhatsApp challenge failure through focused tests or the production UI, then add a regression test at the failing boundary.
- Verify focused state/component tests, production browser flows at mobile and wide desktop sizes, and the repository-wide check before publishing.

## Tasks

- [x] 1. Diagnose and fix WhatsApp phone-change challenge creation, including a focused regression test for the observed failure.
- [x] 2. Add stable clickable section permalinks and consolidate account navigation into the primary navbar row.
- [x] 3. Widen the responsive workspace and split profile information from the standalone profile-picture card, removing the redundant file button.
- [x] 4. Split security identity/enrollment areas into existing-entry and new-entry cards, and place sessions/devices beside applications.
- [x] 5. Render account access as responsive cards with collapsed permission details for every access source, and collapse Danger zone by default.
- [x] 6. Switch organizations in-app while preserving user-scoped profile state and refreshing only organization-scoped account data.
- [x] 7. Update focused tests and browser coverage, run `bun run check`, then use the `commits` skill to commit and push the completed phase and deploy it through the repository's existing deployment workflow.
