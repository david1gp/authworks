import * as v from "valibot"
import { instanceBootstrapAdminSchema } from "./instanceBootstrapAdminSchema.js"
import { instanceSchema } from "./instanceSchema.js"

export const instanceBootstrapAdminResponseSchema = v.strictObject({
  bootstrapAdmin: instanceBootstrapAdminSchema,
  instance: instanceSchema,
})

export type InstanceBootstrapAdminResponse = v.InferOutput<typeof instanceBootstrapAdminResponseSchema>
