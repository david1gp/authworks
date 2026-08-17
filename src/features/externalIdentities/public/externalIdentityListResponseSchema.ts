import * as v from "valibot"
import { externalIdentitySchema } from "./externalIdentitySchema.js"

export const externalIdentityListResponseSchema = v.strictObject({
  externalIdentities: v.array(externalIdentitySchema),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type ExternalIdentityListResponse = v.InferOutput<typeof externalIdentityListResponseSchema>
