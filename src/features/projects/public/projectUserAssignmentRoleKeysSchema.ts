import * as v from "valibot"

export const projectUserAssignmentRoleKeysSchema = v.pipe(
  v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  v.maxLength(200),
)

export type ProjectUserAssignmentRoleKeys = v.InferOutput<typeof projectUserAssignmentRoleKeysSchema>
