import * as v from "valibot"

export const externalIdentityStartRequestSchema = v.strictObject({
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type ExternalIdentityStartRequest = v.InferOutput<typeof externalIdentityStartRequestSchema>
