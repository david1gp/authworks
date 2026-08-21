import * as v from "valibot"

export const externalIdentityStartRequestSchema = v.strictObject({
  interaction: v.optional(v.pipe(v.string(), v.minLength(43), v.maxLength(128), v.regex(/^[A-Za-z0-9_-]+$/))),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type ExternalIdentityStartRequest = v.InferOutput<typeof externalIdentityStartRequestSchema>
