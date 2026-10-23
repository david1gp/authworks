import * as v from "valibot"

export const directoryProjectAssignmentRoleSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  key: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export type DirectoryProjectAssignmentRole = v.InferOutput<typeof directoryProjectAssignmentRoleSchema>
