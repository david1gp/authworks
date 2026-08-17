import * as v from "valibot"

export const emailOtpRequestedEventPayloadSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  purpose: v.literal("sign_in"),
})

export type EmailOtpRequestedEventPayload = v.InferOutput<typeof emailOtpRequestedEventPayloadSchema>
