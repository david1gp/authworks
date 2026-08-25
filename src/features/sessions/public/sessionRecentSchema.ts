import * as v from "valibot"
import { sessionSchema } from "./sessionSchema.js"

export const sessionRecentSchema = v.strictObject({
  ...sessionSchema.entries,
  loginIdentifier: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type SessionRecent = v.InferOutput<typeof sessionRecentSchema>
