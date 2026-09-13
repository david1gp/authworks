import * as v from "valibot"
import { projectUserAssignmentRoleKeysSchema } from "./projectUserAssignmentRoleKeysSchema.js"

export const projectUserAssignmentUpdateRequestSchema = v.strictObject({
  roleKeys: v.optional(projectUserAssignmentRoleKeysSchema),
})

export type ProjectUserAssignmentUpdateRequest = v.InferOutput<typeof projectUserAssignmentUpdateRequestSchema>
