import * as v from "valibot"
import { projectGrantCreateRequestSchema } from "./projectGrantCreateRequestSchema.js"

export const projectGrantUpdateRequestSchema = projectGrantCreateRequestSchema

export type ProjectGrantUpdateRequest = v.InferOutput<typeof projectGrantUpdateRequestSchema>
