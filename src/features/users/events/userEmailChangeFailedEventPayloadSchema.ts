import * as v from "valibot"

export const userEmailChangeFailedEventPayloadSchema = v.strictObject({
  reason: v.picklist(["expired", "invalid_token"]),
})

export type UserEmailChangeFailedEventPayload = v.InferOutput<typeof userEmailChangeFailedEventPayloadSchema>
