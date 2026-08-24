import type { MessageKey } from "../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../ui/i18n/model/messageTranslate.js"
import type { DemoFixtureState } from "./demoFixtureStateSchema.js"

const demoFixtureStateKeys: Record<DemoFixtureState, MessageKey> = {
  accepted: "demo.fixture.accepted",
  active: "demo.fixture.active",
  "assurance-required": "demo.fixture.assuranceRequired",
  "cross-tenant": "demo.fixture.crossTenant",
  continuing: "demo.fixture.continuing",
  declined: "demo.fixture.declined",
  empty: "demo.fixture.empty",
  ended: "demo.fixture.ended",
  error: "demo.fixture.error",
  expired: "demo.fixture.expired",
  expiring: "demo.fixture.expiring",
  fatal: "demo.fixture.fatal",
  loading: "demo.fixture.loading",
  "nested-rejected": "demo.fixture.nestedRejected",
  "one-time": "demo.fixture.oneTime",
  "mfa-continuation": "demo.fixture.continuing",
  "mfa-enroll": "demo.fixture.loading",
  "mfa-loading": "demo.fixture.loading",
  "mfa-optional": "demo.fixture.loading",
  "mfa-retry": "demo.fixture.error",
  "mfa-satisfied": "demo.fixture.success",
  "mfa-setup-unavailable": "demo.fixture.error",
  "passkey-ceremony-failure": "demo.fixture.error",
  "passkey-pending": "demo.fixture.loading",
  "passkey-permission-denied": "demo.fixture.permissionDenied",
  "passkey-unsupported": "demo.fixture.permissionDenied",
  "password-change-expired": "demo.fixture.passwordChangeExpired",
  "permission-denied": "demo.fixture.permissionDenied",
  redacted: "demo.fixture.redacted",
  "recovery-fatal": "demo.fixture.recoveryFatal",
  "recovery-loading": "demo.fixture.recoveryLoading",
  replayed: "demo.fixture.replayed",
  "reset-invalid": "demo.fixture.resetInvalid",
  "reset-loading": "demo.fixture.resetLoading",
  success: "demo.fixture.success",
}

/** Translates the fixture-state selector labels, falling back to the raw state key. */
export function demoFixtureStateLabel(state: DemoFixtureState): string {
  const key = demoFixtureStateKeys[state]
  if (key !== undefined) return messageTranslate(key)
  return state
}
