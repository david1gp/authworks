import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectRoleSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  group: v.optional(v.pipe(v.string(), v.maxLength(200))),
  id: projectResourceIdSchema,
  instanceId: projectResourceIdSchema,
  key: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  projectId: projectResourceIdSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type ProjectRole = v.InferOutput<typeof projectRoleSchema>
