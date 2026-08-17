import * as v from "valibot"
import { projectStatusSchema } from "../domain/projectStatusSchema.js"

export const projectLifecycleRequestSchema = v.strictObject({ status: projectStatusSchema })

export type ProjectLifecycleRequest = v.InferOutput<typeof projectLifecycleRequestSchema>
