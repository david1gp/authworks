import * as v from "valibot"

export const passwordCredentialChangedEventPayloadSchema = v.strictObject({
  reason: v.picklist(["registration", "change", "recovery"]),
})

export type PasswordCredentialChangedEventPayload = v.InferOutput<typeof passwordCredentialChangedEventPayloadSchema>
