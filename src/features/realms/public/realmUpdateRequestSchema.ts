import * as v from "valibot"
import { realmStatusSchema } from "../domain/realmStatusSchema.js"

export const realmUpdateRequestSchema = v.strictObject({
  domain: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(253))),
  domains: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(253))), v.maxLength(31))),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  status: v.optional(realmStatusSchema),
})

export type RealmUpdateRequest = v.InferOutput<typeof realmUpdateRequestSchema>
