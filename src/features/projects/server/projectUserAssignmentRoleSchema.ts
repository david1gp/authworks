import * as v from "valibot"

export const projectUserAssignmentRoleSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  key: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export type ProjectUserAssignmentRole = v.InferOutput<typeof projectUserAssignmentRoleSchema>
