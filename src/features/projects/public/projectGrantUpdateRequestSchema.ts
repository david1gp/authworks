import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectGrantUpdateRequestSchema = v.strictObject({
  grantedOrganizationId: v.optional(projectResourceIdSchema),
  roleKeys: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))), v.maxLength(200))),
})

export type ProjectGrantUpdateRequest = v.InferOutput<typeof projectGrantUpdateRequestSchema>
