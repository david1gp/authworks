import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"

/** Fixture states exposed by the login demo selector and its scenario registry. */
export const loginDemoStates: readonly DemoFixtureState[] = [
  "success",
  "error",
  "loading",
  "continuing",
  "fatal",
  "empty",
  "expired",
  "mfa-continuation",
  "mfa-enroll",
  "mfa-loading",
  "mfa-optional",
  "mfa-retry",
  "mfa-satisfied",
  "mfa-setup-unavailable",
  "passkey-ceremony-failure",
  "passkey-pending",
  "passkey-permission-denied",
  "passkey-unsupported",
  "password-change-expired",
  "recovery-fatal",
  "recovery-loading",
  "reset-invalid",
  "reset-loading",
  "permission-denied",
]
