import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { teamLeaderSummarySchema } from "./teamLeaderSummarySchema.js"
import { teamSlugSchema } from "./teamSlugSchema.js"

export const teamSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: v.pipe(v.string(), v.minLength(1)),
  leader: teamLeaderSummarySchema,
  memberCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  organizationId: v.pipe(v.string(), v.minLength(1)),
  realmId: realmResourceIdSchema,
  slug: teamSlugSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type Team = v.InferOutput<typeof teamSchema>
