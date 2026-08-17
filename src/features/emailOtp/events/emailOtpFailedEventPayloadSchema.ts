import * as v from "valibot"

export const emailOtpFailedEventPayloadSchema = v.strictObject({
  attempts: v.pipe(v.number(), v.integer(), v.minValue(0)),
  exhausted: v.boolean(),
  reason: v.picklist(["authorization_failed", "expired", "invalid_code"]),
})

export type EmailOtpFailedEventPayload = v.InferOutput<typeof emailOtpFailedEventPayloadSchema>
