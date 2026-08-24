# Login Web UI parity

## Goal

Port the production login Web UI details from `../zitadel-login` into Authworks so every Authworks-supported login state has matching visual quality, interaction behavior, responsiveness, accessibility, branding, theme, and demo coverage.

## Decisions

- Treat `../zitadel-login/client/src` and its rendered demo as the visual and interaction source of truth.
- Preserve Authworks feature ownership, public contracts, production adapters, `/login/**` routes, and `/demo/login/**` namespace.
- Port only Authworks-supported factors: password, email OTP, external identity providers, passkeys, TOTP, MFA email OTP, MFA passkeys, and recovery codes. Do not add ZITADEL-only SMS OTP, U2F, or native-ZITADEL fallback behavior.
- Keep Authworks registration, verification, logout, recovery-code, and interaction-completion additions, styled consistently with the reference.
- Keep unrelated working-tree changes and `.env` untouched.

## Approach

- Restore the reference login-specific shell, design tokens, patterned screen backgrounds, theme controls, branding details, focus treatment, reduced-motion behavior, and responsive geometry.
- Bring chooser and form interactions to parity, including combined recent accounts and methods, remembered identifiers, masked destinations, resend states, notices, and transition feedback.
- Model the applicable missing loading, continuing, fatal, expired, provider-failure, passkey, MFA enrollment, and recovery states through shared screens with production and demo adapters.
- Make the demo registry expose every supported state and verify representative desktop, mobile, light, dark, system-theme, RTL, keyboard, and error paths in a browser.

## Tasks

- [x] 1. Port the login shell visual system, backgrounds, branding, three-way theme control, responsive layout, and global accessibility details.
- [x] 2. Bring method chooser, recent-account selection, password, and email OTP interactions to reference parity.
- [x] 3. Add applicable missing shared login states and panel behavior for initialization, continuation, providers, passkeys, MFA, password change, and recovery.
- [x] 4. Extend production/demo adapters, fixture data, localized messages, and demo routes for every added state without changing Authworks transport contracts unnecessarily.
- [x] 5. Add focused unit/E2E coverage and complete browser verification across desktop/mobile, themes, RTL, keyboard, and error/loading states.

## Paths

- `src/features/login/ui/`
- `src/features/login/model/`
- `src/features/sessions/ui/`
- `src/features/passwords/ui/`
- `src/features/emailOtp/ui/`
- `src/features/passkeys/ui/`
- `src/features/mfa/ui/`
- `src/features/externalIdentities/ui/`
- `src/features/demo/`
- `src/ui/i18n/`
- `src/ui/styles.css`
- `test/ui/`
- `e2e/`
