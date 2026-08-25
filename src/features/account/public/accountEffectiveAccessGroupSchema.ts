import * as v from "valibot"
import { organizationSchema } from "../../organizations/public/organizationSchema.js"
import { accountEffectiveAccessEntrySchema } from "./accountEffectiveAccessEntrySchema.js"

export const accountEffectiveAccessGroupSchema = v.strictObject({
  entries: v.array(accountEffectiveAccessEntrySchema),
  organization: organizationSchema,
})

export type AccountEffectiveAccessGroup = v.InferOutput<typeof accountEffectiveAccessGroupSchema>
