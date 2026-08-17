import * as v from "valibot"

export const passkeyAuthenticationStartRequestSchema = v.strictObject({
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type PasskeyAuthenticationStartRequest = v.InferOutput<typeof passkeyAuthenticationStartRequestSchema>
