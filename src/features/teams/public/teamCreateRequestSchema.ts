import * as v from "valibot"
import { teamSlugSchema } from "./teamSlugSchema.js"

export const teamCreateRequestSchema = v.strictObject({
  leaderUserId: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  slug: teamSlugSchema,
})

export type TeamCreateRequest = v.InferOutput<typeof teamCreateRequestSchema>
