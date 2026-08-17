import * as v from "valibot"
import { projectSchema } from "./projectSchema.js"

export const projectResponseSchema = v.strictObject({ project: projectSchema })

export type ProjectResponse = v.InferOutput<typeof projectResponseSchema>
