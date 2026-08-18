import * as v from "valibot"
import { realmBootstrapAdminSchema } from "./realmBootstrapAdminSchema.js"
import { realmSchema } from "./realmSchema.js"

export const realmBootstrapAdminResponseSchema = v.strictObject({
  bootstrapAdmin: realmBootstrapAdminSchema,
  realm: realmSchema,
})

export type RealmBootstrapAdminResponse = v.InferOutput<typeof realmBootstrapAdminResponseSchema>
