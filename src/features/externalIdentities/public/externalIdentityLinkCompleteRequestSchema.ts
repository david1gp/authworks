import * as v from "valibot"

export const externalIdentityLinkCompleteRequestSchema = v.strictObject({
  confirmationToken: v.pipe(v.string(), v.minLength(1)),
  confirm: v.literal(true),
})

export type ExternalIdentityLinkCompleteRequest = v.InferOutput<typeof externalIdentityLinkCompleteRequestSchema>
