import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectGrantDeleteResponseSchema = v.strictObject({
  deleted: v.boolean(),
  grantId: projectResourceIdSchema,
})

export type ProjectGrantDeleteResponse = v.InferOutput<typeof projectGrantDeleteResponseSchema>
