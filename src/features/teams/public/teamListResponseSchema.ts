import * as v from "valibot"
import { teamSchema } from "./teamSchema.js"

// Unassigned count stays optional for list-envelope conformance (every public list
// response parses `{ items: [] }`); the server always sends the computed count.
export const teamListResponseSchema = v.strictObject({
  items: v.array(teamSchema),
  nextPageToken: v.optional(v.pipe(v.string(), v.minLength(1))),
  unassignedCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
})

export type TeamListResponse = v.InferOutput<typeof teamListResponseSchema>
