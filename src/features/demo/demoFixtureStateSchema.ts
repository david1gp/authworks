import * as v from "valibot"

export const demoFixtureStateSchema = v.picklist([
  "success",
  "empty",
  "loading",
  "error",
  "permission-denied",
  "expired",
  "replayed",
  "accepted",
  "declined",
  "one-time",
  "redacted",
  "cross-tenant",
  // Guarded impersonation states.
  "assurance-required",
  "active",
  "expiring",
  "nested-rejected",
  "ended",
])

export type DemoFixtureState = v.InferOutput<typeof demoFixtureStateSchema>
