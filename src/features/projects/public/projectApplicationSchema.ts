import * as v from "valibot"
import { projectApplicationStatusSchema } from "./projectApplicationStatusSchema.js"
import { projectApplicationTypeSchema } from "./projectApplicationTypeSchema.js"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectApplicationSchema = v.strictObject({
  applicationType: projectApplicationTypeSchema,
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: projectResourceIdSchema,
  realmId: projectResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  projectId: projectResourceIdSchema,
  status: projectApplicationStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type ProjectApplication = v.InferOutput<typeof projectApplicationSchema>
