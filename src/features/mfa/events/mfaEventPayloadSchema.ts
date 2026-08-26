import * as v from "valibot"

export const mfaEventPayloadSchema = v.strictObject({
  attempts: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  challengeId: v.optional(v.pipe(v.string(), v.minLength(1))),
  codeCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  enrollmentId: v.optional(v.pipe(v.string(), v.minLength(1))),
  factor: v.optional(v.picklist(["email_otp", "passkey", "recovery_code", "totp"])),
  locked: v.optional(v.boolean()),
  mode: v.optional(v.picklist(["disabled", "optional", "required"])),
  purpose: v.optional(v.picklist(["login", "step_up"])),
  userId: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type MfaEventPayload = v.InferOutput<typeof mfaEventPayloadSchema>
