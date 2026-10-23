import * as v from "valibot"

export const realmAdministratorRevokedEventPayloadSchema = v.strictObject({
  userId: v.string(),
})

export type RealmAdministratorRevokedEventPayload = v.InferOutput<typeof realmAdministratorRevokedEventPayloadSchema>
