import * as v from "valibot"

export const projectUserAssignmentRemoveResponseSchema = v.strictObject({ removed: v.literal(true) })

export type ProjectUserAssignmentRemoveResponse = v.InferOutput<typeof projectUserAssignmentRemoveResponseSchema>
