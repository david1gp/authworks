import * as v from "valibot"
import { projectGrantStatusSchema } from "../domain/projectGrantStatusSchema.js"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectGrantSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  grantedOrganizationId: projectResourceIdSchema,
  id: projectResourceIdSchema,
  instanceId: projectResourceIdSchema,
  organizationId: projectResourceIdSchema,
  projectId: projectResourceIdSchema,
  roleKeys: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))), v.maxLength(200)),
  status: projectGrantStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type ProjectGrant = v.InferOutput<typeof projectGrantSchema>
