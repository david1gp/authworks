import * as v from "valibot"
import { organizationStatusSchema } from "./organizationStatusSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: organizationResourceIdSchema,
  realmId: organizationResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  status: organizationStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type Organization = v.InferOutput<typeof organizationSchema>
