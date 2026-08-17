import * as v from "valibot"
import { externalIdentitySchema } from "./externalIdentitySchema.js"

export const externalIdentityLinkCompleteResponseSchema = v.strictObject({
  externalIdentity: externalIdentitySchema,
  linked: v.literal(true),
})

export type ExternalIdentityLinkCompleteResponse = v.InferOutput<typeof externalIdentityLinkCompleteResponseSchema>
