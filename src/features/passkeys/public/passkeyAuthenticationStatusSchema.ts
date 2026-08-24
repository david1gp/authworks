import * as v from "valibot"

export const passkeyAuthenticationStatusSchema = v.picklist([
  "ready",
  "pending",
  "unsupported",
  "permission-denied",
  "ceremony-failure",
  "failure",
  "mfa-continuation",
])

export type PasskeyAuthenticationStatus = v.InferOutput<typeof passkeyAuthenticationStatusSchema>
