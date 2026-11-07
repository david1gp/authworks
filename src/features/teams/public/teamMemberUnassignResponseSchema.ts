import * as v from "valibot"

export const teamMemberUnassignResponseSchema = v.strictObject({ unassigned: v.literal(true) })

export type TeamMemberUnassignResponse = v.InferOutput<typeof teamMemberUnassignResponseSchema>
