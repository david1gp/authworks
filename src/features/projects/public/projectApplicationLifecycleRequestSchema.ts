import * as v from "valibot"
import { projectApplicationStatusSchema } from "../domain/projectApplicationStatusSchema.js"

export const projectApplicationLifecycleRequestSchema = v.strictObject({ status: projectApplicationStatusSchema })

export type ProjectApplicationLifecycleRequest = v.InferOutput<typeof projectApplicationLifecycleRequestSchema>
