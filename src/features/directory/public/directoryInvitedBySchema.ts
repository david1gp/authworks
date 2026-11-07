import * as v from "valibot"

export const directoryInvitedBySchema = v.strictObject({
  acceptedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  displayName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  email: v.optional(v.pipe(v.string(), v.minLength(3), v.maxLength(320))),
  invitedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type DirectoryInvitedBy = v.InferOutput<typeof directoryInvitedBySchema>
