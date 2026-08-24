import * as v from "valibot"

export const externalIdentityLoginSubrouteSchema = v.picklist([
  "failure",
  "account-not-found",
  "linking-failed",
  "registration-failed",
])

export type ExternalIdentityLoginSubroute = v.InferOutput<typeof externalIdentityLoginSubrouteSchema>
