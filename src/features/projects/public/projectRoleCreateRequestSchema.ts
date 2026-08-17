import * as v from "valibot"

export const projectRoleCreateRequestSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  group: v.optional(v.pipe(v.string(), v.maxLength(200))),
  key: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export type ProjectRoleCreateRequest = v.InferOutput<typeof projectRoleCreateRequestSchema>
