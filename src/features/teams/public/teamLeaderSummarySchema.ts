import * as v from "valibot"

export const teamLeaderSummarySchema = v.strictObject({
  displayName: v.optional(v.nullable(v.string())),
  email: v.optional(v.nullable(v.string())),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type TeamLeaderSummary = v.InferOutput<typeof teamLeaderSummarySchema>
