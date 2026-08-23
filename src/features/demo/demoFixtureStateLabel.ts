import type { MessageKey } from "../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../ui/i18n/model/messageTranslate.js"
import type { DemoFixtureState } from "./demoFixtureStateSchema.js"

const demoFixtureStateKeys: Record<DemoFixtureState, MessageKey> = {
  accepted: "demo.fixture.accepted",
  active: "demo.fixture.active",
  "assurance-required": "demo.fixture.assuranceRequired",
  "cross-tenant": "demo.fixture.crossTenant",
  declined: "demo.fixture.declined",
  empty: "demo.fixture.empty",
  ended: "demo.fixture.ended",
  error: "demo.fixture.error",
  expired: "demo.fixture.expired",
  expiring: "demo.fixture.expiring",
  loading: "demo.fixture.loading",
  "nested-rejected": "demo.fixture.nestedRejected",
  "one-time": "demo.fixture.oneTime",
  "permission-denied": "demo.fixture.permissionDenied",
  redacted: "demo.fixture.redacted",
  replayed: "demo.fixture.replayed",
  success: "demo.fixture.success",
}

/** Translates the fixture-state selector labels, falling back to the raw state key. */
export function demoFixtureStateLabel(state: DemoFixtureState): string {
  const key = demoFixtureStateKeys[state]
  if (key !== undefined) return messageTranslate(key)
  return state
}
