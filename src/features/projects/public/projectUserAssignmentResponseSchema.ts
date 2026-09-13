import * as v from "valibot"
import { projectUserAssignmentSchema } from "./projectUserAssignmentSchema.js"

export const projectUserAssignmentResponseSchema = v.strictObject({ assignment: projectUserAssignmentSchema })

export type ProjectUserAssignmentResponse = v.InferOutput<typeof projectUserAssignmentResponseSchema>
