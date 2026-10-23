import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"

export const realmAdministratorGrantRequestSchema = v.strictObject({
  userId: userResourceIdSchema,
})

export type RealmAdministratorGrantRequest = v.InferOutput<typeof realmAdministratorGrantRequestSchema>
