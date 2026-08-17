import * as v from "valibot"
import { projectGrantStatusSchema } from "../domain/projectGrantStatusSchema.js"

export const projectGrantLifecycleRequestSchema = v.strictObject({ status: projectGrantStatusSchema })

export type ProjectGrantLifecycleRequest = v.InferOutput<typeof projectGrantLifecycleRequestSchema>
