import * as v from "valibot"
import { projectApplicationSchema } from "./projectApplicationSchema.js"

export const projectApplicationListResponseSchema = v.strictObject({ applications: v.array(projectApplicationSchema) })

export type ProjectApplicationListResponse = v.InferOutput<typeof projectApplicationListResponseSchema>
