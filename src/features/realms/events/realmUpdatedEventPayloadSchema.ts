import * as v from "valibot"
import { realmStatusSchema } from "../domain/realmStatusSchema.js"

export const realmUpdatedEventPayloadSchema = v.strictObject({
  domain: v.string(),
  name: v.string(),
  status: realmStatusSchema,
})

export type RealmUpdatedEventPayload = v.InferOutput<typeof realmUpdatedEventPayloadSchema>
