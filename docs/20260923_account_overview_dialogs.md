# Account overview and dialogs

## Goal
Make `/account` a consistent overview with important values and statuses visible and editing in focused dialogs. `/demo/account` must render the same presentation components with fixture-backed adapters so the design can be reviewed without authentication.

## Decisions
- Preserve the existing shared AccountWorkspace architecture and production/demo adapters; do not introduce a separate demo design.
- Profile shows avatar, identity, important personal information, email/phone verification status, and an Edit profile action rather than an always-open personal-information form.
- Avatar activation opens a picture dialog containing preview, file drop area, Choose file, supported formats and 512 KiB guidance, validation, Cancel, Save, and Remove picture when applicable. Keep format/size guidance out of the overview. Preserve actual upload validation and persistence contracts. Selection is staged until Save; Cancel does not persist edits.
- Security, devices/applications, and access use consistent headings, summary rows, badges, spacing, and secondary action placement. Keep important warnings and current-device status visible. Preserve existing long-list/history views rather than forcing them into cramped dialogs.
- Keep danger actions visually distinct at the bottom and preserve destructive confirmation.
- Reuse existing libraries, dialog primitives, styling conventions, and localized strings. Do not change backend contracts or implement unrelated roadmap work.

## Tasks
1. Implement shared profile overview and profile/picture dialogs, including localized strings and focused tests. Status: completed.
2. Align remaining shared account section presentation with the overview/action pattern without changing behavior. Status: completed.
3. Update focused account browser coverage and verify demo and production presentation, responsive behavior, dialog interactions, and repository check. Status: completed.

## Verification approach
Use focused tests during each increment, concurrency at most one. Delay browser/e2e runs until UI increments are complete. Use repository-managed preview configuration only. Run `bun run check` before completion; after any failure rerun only the failing test/file or failing check as appropriate. Browser verification is delegated to the browser agent.

## Current context
Both routes compose AccountWorkspace with distinct data adapters and share the profile overview and staged profile/picture dialogs. Remaining sections use aligned headings, spacing, and secondary actions. Existing email/phone dialogs and account lifecycle behaviors are retained. Nested confirmations use the existing Corvu dialog system with underlying-dialog interaction suspended while confirmation is open. All existing locale catalogs include the new interface strings. Implementation and verification are complete. Existing authoritative repository plans remain applicable outside this presentation-only change.
