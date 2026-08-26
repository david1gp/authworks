import * as v from "valibot"

export const passkeyMfaAuthenticationStartRequestSchema = v.strictObject({
  token: v.pipe(v.string(), v.minLength(1)),
})

export type PasskeyMfaAuthenticationStartRequest = v.InferOutput<typeof passkeyMfaAuthenticationStartRequestSchema>
