import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectGrantCreateRequestSchema = v.strictObject({
  grantedOrganizationId: projectResourceIdSchema,
  roleKeys: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))), v.maxLength(200)),
})

export type ProjectGrantCreateRequest = v.InferOutput<typeof projectGrantCreateRequestSchema>
