import * as v from "valibot"
import { externalIdentityProviderSchema } from "./externalIdentityProviderSchema.js"

export const externalIdentityProviderListResponseSchema = v.strictObject({
  providers: v.array(externalIdentityProviderSchema),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type ExternalIdentityProviderListResponse = v.InferOutput<typeof externalIdentityProviderListResponseSchema>
