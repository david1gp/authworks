import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectCreateRequestSchema = v.strictObject({
  authorizationRequired: v.optional(v.boolean()),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  organizationId: projectResourceIdSchema,
  projectAccessRequired: v.optional(v.boolean()),
})

export type ProjectCreateRequest = v.InferOutput<typeof projectCreateRequestSchema>
