import * as v from "valibot"
import { teamSlugSchema } from "./teamSlugSchema.js"

export const teamUpdateRequestSchema = v.strictObject({
  leaderUserId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  slug: v.optional(teamSlugSchema),
})

export type TeamUpdateRequest = v.InferOutput<typeof teamUpdateRequestSchema>
