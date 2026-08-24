import * as v from "valibot"

export const externalIdentityLoginStatusSchema = v.picklist([
  "ready",
  "pending",
  "failure",
  "account-not-found",
  "linking-failed",
  "registration-failed",
])

export type ExternalIdentityLoginStatus = v.InferOutput<typeof externalIdentityLoginStatusSchema>
