import * as v from "valibot"

export const sessionRecentResumeRequestSchema = v.strictObject({
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  sessionId: v.pipe(v.string(), v.minLength(1)),
})

export type SessionRecentResumeRequest = v.InferOutput<typeof sessionRecentResumeRequestSchema>
