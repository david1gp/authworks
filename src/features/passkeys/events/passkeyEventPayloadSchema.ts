import * as v from "valibot"

export const passkeyEventPayloadSchema = v.strictObject({
  backedUp: v.optional(v.boolean()),
  ceremonyId: v.optional(v.pipe(v.string(), v.minLength(1))),
  credentialId: v.optional(v.pipe(v.string(), v.minLength(1))),
  counter: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  purpose: v.optional(v.picklist(["passwordless", "mfa", "step_up"])),
  userId: v.optional(v.pipe(v.string(), v.minLength(1))),
  userVerified: v.optional(v.boolean()),
})

export type PasskeyEventPayload = v.InferOutput<typeof passkeyEventPayloadSchema>
