import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectApplicationDeleteResponseSchema = v.strictObject({
  applicationId: projectResourceIdSchema,
  deleted: v.boolean(),
})

export type ProjectApplicationDeleteResponse = v.InferOutput<typeof projectApplicationDeleteResponseSchema>
