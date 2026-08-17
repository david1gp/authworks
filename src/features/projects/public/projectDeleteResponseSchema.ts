import * as v from "valibot"
import { projectResourceIdSchema } from "./projectResourceIdSchema.js"

export const projectDeleteResponseSchema = v.strictObject({ deleted: v.boolean(), projectId: projectResourceIdSchema })

export type ProjectDeleteResponse = v.InferOutput<typeof projectDeleteResponseSchema>
