import * as v from "valibot"
import { sessionSchema } from "./sessionSchema.js"

export const sessionListResponseSchema = v.strictObject({
  sessions: v.array(sessionSchema),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type SessionListResponse = v.InferOutput<typeof sessionListResponseSchema>
