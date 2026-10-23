import * as v from "valibot"

export const realmAdministratorGrantedEventPayloadSchema = v.strictObject({
  userId: v.string(),
})

export type RealmAdministratorGrantedEventPayload = v.InferOutput<typeof realmAdministratorGrantedEventPayloadSchema>
