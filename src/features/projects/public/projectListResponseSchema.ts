import * as v from "valibot"
import { projectSchema } from "./projectSchema.js"

export const projectListResponseSchema = v.strictObject({ projects: v.array(projectSchema) })

export type ProjectListResponse = v.InferOutput<typeof projectListResponseSchema>
