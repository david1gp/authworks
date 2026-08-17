import * as v from "valibot"

export const passwordLoginEventPayloadSchema = v.strictObject({
  reason: v.picklist(["invalid_credentials", "locked", "not_verified", "inactive"]),
})

export type PasswordLoginEventPayload = v.InferOutput<typeof passwordLoginEventPayloadSchema>
