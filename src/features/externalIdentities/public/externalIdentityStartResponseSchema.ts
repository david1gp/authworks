import * as v from "valibot"

export const externalIdentityStartResponseSchema = v.strictObject({
  authorizationUrl: v.pipe(v.string(), v.url()),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  providerId: v.pipe(v.string(), v.minLength(1)),
})

export type ExternalIdentityStartResponse = v.InferOutput<typeof externalIdentityStartResponseSchema>
