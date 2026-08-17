import * as v from "valibot"
import { projectGrantSchema } from "./projectGrantSchema.js"

export const projectGrantListResponseSchema = v.strictObject({ grants: v.array(projectGrantSchema) })

export type ProjectGrantListResponse = v.InferOutput<typeof projectGrantListResponseSchema>
