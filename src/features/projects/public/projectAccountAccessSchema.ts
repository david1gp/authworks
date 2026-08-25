import * as v from "valibot"
import { organizationResourceIdSchema } from "../../organizations/public/organizationResourceIdSchema.js"
import { projectGrantSchema } from "./projectGrantSchema.js"
import { projectSchema } from "./projectSchema.js"

export const projectAccountAccessSchema = v.strictObject({
  grant: v.optional(projectGrantSchema),
  organizationId: organizationResourceIdSchema,
  project: projectSchema,
  roleKeys: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
})

export type ProjectAccountAccess = v.InferOutput<typeof projectAccountAccessSchema>
