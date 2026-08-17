import * as v from "valibot"
import { projectStatusSchema } from "../domain/projectStatusSchema.js"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectSchema = v.strictObject({
  authorizationRequired: v.boolean(),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: projectResourceIdSchema,
  instanceId: projectResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  organizationId: projectResourceIdSchema,
  projectAccessRequired: v.boolean(),
  status: projectStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type Project = v.InferOutput<typeof projectSchema>
