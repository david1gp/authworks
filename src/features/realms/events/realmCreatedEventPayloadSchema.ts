import * as v from "valibot"

export const realmCreatedEventPayloadSchema = v.strictObject({
  domain: v.string(),
  name: v.string(),
})

export type RealmCreatedEventPayload = v.InferOutput<typeof realmCreatedEventPayloadSchema>
