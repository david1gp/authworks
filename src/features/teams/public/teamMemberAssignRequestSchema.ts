import * as v from "valibot"

export const teamMemberAssignRequestSchema = v.strictObject({
  userId: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
})

export type TeamMemberAssignRequest = v.InferOutput<typeof teamMemberAssignRequestSchema>
