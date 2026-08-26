import * as v from "valibot"

export const eventSecurityHistoryCategorySchema = v.picklist([
  "email_changes",
  "impersonation",
  "linked_identities",
  "mfa",
  "passwords",
  "passkeys",
  "refresh_tokens",
  "sessions",
])

export type EventSecurityHistoryCategory = v.InferOutput<typeof eventSecurityHistoryCategorySchema>
