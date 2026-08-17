import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectAccessResponseSchema = v.strictObject({
  grantedOrganizationId: v.optional(projectResourceIdSchema),
  projectId: projectResourceIdSchema,
  roleKeys: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
})

export type ProjectAccessResponse = v.InferOutput<typeof projectAccessResponseSchema>
