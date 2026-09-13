import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"
import { projectUserAssignmentRoleKeysSchema } from "./projectUserAssignmentRoleKeysSchema.js"

export const projectUserAssignmentSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: projectResourceIdSchema,
  projectId: projectResourceIdSchema,
  realmId: realmResourceIdSchema,
  roleKeys: projectUserAssignmentRoleKeysSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: userResourceIdSchema,
})

export type ProjectUserAssignment = v.InferOutput<typeof projectUserAssignmentSchema>
