import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { projectUserAssignmentRoleKeysSchema } from "./projectUserAssignmentRoleKeysSchema.js"

export const projectUserAssignmentCreateRequestSchema = v.strictObject({
  roleKeys: v.optional(projectUserAssignmentRoleKeysSchema),
  userId: userResourceIdSchema,
})

export type ProjectUserAssignmentCreateRequest = v.InferOutput<typeof projectUserAssignmentCreateRequestSchema>
