import * as v from "valibot"

export const emailOtpVerifiedEventPayloadSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type EmailOtpVerifiedEventPayload = v.InferOutput<typeof emailOtpVerifiedEventPayloadSchema>
