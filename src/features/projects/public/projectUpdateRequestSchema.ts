import * as v from "valibot"

export const projectUpdateRequestSchema = v.strictObject({
  authorizationRequired: v.optional(v.boolean()),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  projectAccessRequired: v.optional(v.boolean()),
})

export type ProjectUpdateRequest = v.InferOutput<typeof projectUpdateRequestSchema>
