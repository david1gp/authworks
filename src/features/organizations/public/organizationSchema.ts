import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"
import { organizationSlugSchema } from "./organizationSlugSchema.js"
import { organizationStatusSchema } from "./organizationStatusSchema.js"

export const organizationSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: organizationResourceIdSchema,
  realmId: realmResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  slug: organizationSlugSchema,
  status: organizationStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type Organization = v.InferOutput<typeof organizationSchema>
