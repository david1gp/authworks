# Compact account overview

## Goal and scope

Redesign `/demo/account` and the shared production account workspace as a compact, clean account overview. Preserve existing account behavior, fixture-backed demo state, production API/state boundaries, localization, and accessibility. The established `docs/20260817_authworks.md` architecture remains authoritative.

## Decisions

- Use independently expandable, initially collapsed cards for individual account subjects, grouped under Profile, Security, Devices and applications, Access, and Danger zone. Each closed card communicates an icon, concise title, useful current value/count, and configured/missing status when applicable. Expanded content contains lists, explanation/helper copy, and secondary detail. Keep section anchors and mobile responsiveness.
- Viewing or expanding never changes data. Clickable item rows open labelled dialogs for details and changes. All account mutations—including primary-email selection, removal, revocation, setup, and deletion—have their final control inside a dialog; reuse existing confirmation, step-up, verification and one-time-secret safeguards rather than weakening them. Keep pagination and read-only navigation within expanded content.
- An authenticator card shows its icon, a small configured/missing indicator and status text. Expanded content has clickable authenticator rows followed by `Add authenticator` as the last row. No inline management buttons in the resting overview.
- Show subtle, accessible copy-icon buttons next to copyable identity values (at least username, email and phone when present), with success/failure feedback. Copying does not open an edit dialog.
- Profile is user-wide, independent of the currently active organization. Remove organization switching from the account-page UI; organization selection under Access only changes the organization whose membership/roles are inspected. Do not remove underlying session-switch APIs or unrelated global selectors.
- Match `/login`'s restrained surfaces, typography and polish using existing tokens/components, not its narrow login frame. Use package.json's existing libraries; do not add unrelated dependencies.

## Approach

Reuse the shared account presentation in `src/features/account/ui/` for demo and production, with adapters continuing to supply state. Build on `AccountDisclosure`, `AuthenticatedDialog`, and existing icon/button primitives. Avoid a demo-only fork, and preserve existing route destinations and data contracts. Hide descriptions until their corresponding disclosure is open. Keep dangerous actions behind explicit dialog confirmation.

## Tasks

1. **Shell and card primitives (done)** — Refactor account workspace and reusable account disclosure/card presentation to yield compact independently collapsible summaries, meaningful icons/status, clean responsive rhythm, and section anchors. Preserve stable adapter compositions and existing accessible disclosure behavior. Do not alter feature state or dialogs yet.
2. **Profile and contact (done)** — Compact identity, personal information, email, and phone presentation; add subtle accessible copy controls; make address rows open dialogs containing primary/remove actions; preserve add/verify/phone/picture/profile workflows and demo/production parity. Keep instructions inside expanded cards/dialogs.
3. **Security (done)** — Redesign password, passkey, authenticator, linked identity, and recovery management as compact status cards with dialog-based mutation controls. Authenticator list rows open a management dialog and Add is the final row. Preserve setup/verification/step-up/recovery-code semantics.
4. **Devices and access (done)** — Collapse activity, sessions, tokens, organizations, permissions and consents into compact cards; place revoke/consent and other mutations in dialogs; remove organization-switch control from account workspace and any account-page destination, retaining read-only organization selection and effective-access inspection.
5. **Danger, localization and verification (done)** — Move deletion confirmation into a dialog, polish states/copy/responsiveness/a11y and localized text, update focused account unit tests. Run focused tests during implementation and `bun run check` once at the end. Perform final browser verification on demo and production-compatible presentation, including desktop/mobile and action flows; defer full e2e until implementation is stable.

## Current context

- Shared compact cards cover profile/contact, security, devices, access and deletion. Existing passkeys have no rename API or persisted name, so passkey management exposes only supported actions. Organization switching is removed from account UI, while account membership inspection and underlying API remain. Locale coverage and account browser tests are complete; desktop/mobile browser checks and `bun run check` passed.
