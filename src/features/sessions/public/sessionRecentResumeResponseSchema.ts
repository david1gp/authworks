import * as v from "valibot"
import { sessionSchema } from "./sessionSchema.js"

export const sessionRecentResumeResponseSchema = v.strictObject({ session: sessionSchema })

export type SessionRecentResumeResponse = v.InferOutput<typeof sessionRecentResumeResponseSchema>
