import * as v from "valibot"
import { accountEffectiveAccessEntrySchema } from "./accountEffectiveAccessEntrySchema.js"

export const accountEffectiveAccessListResponseSchema = v.strictObject({
  items: v.array(accountEffectiveAccessEntrySchema),
  nextPageToken: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type AccountEffectiveAccessListResponse = v.InferOutput<typeof accountEffectiveAccessListResponseSchema>
