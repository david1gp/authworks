import * as v from "valibot"
import { sessionSchema } from "./sessionSchema.js"

export const sessionResponseSchema = v.strictObject({ session: sessionSchema })

export type SessionResponse = v.InferOutput<typeof sessionResponseSchema>
