import * as v from "valibot"

export const projectRoleUpdateRequestSchema = v.strictObject({
  displayName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  group: v.optional(v.pipe(v.string(), v.maxLength(200))),
})

export type ProjectRoleUpdateRequest = v.InferOutput<typeof projectRoleUpdateRequestSchema>
