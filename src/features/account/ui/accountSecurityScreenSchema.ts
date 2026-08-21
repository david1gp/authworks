import * as v from "valibot"

export const accountSecurityScreenSchema = v.picklist([
  "sessions",
  "passkeys",
  "factors",
  "recovery-codes",
  "identities",
])

export type AccountSecurityScreen = v.InferOutput<typeof accountSecurityScreenSchema>
