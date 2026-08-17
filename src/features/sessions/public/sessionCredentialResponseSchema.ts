import * as v from "valibot"
import { sessionSchema } from "./sessionSchema.js"

export const sessionCredentialResponseSchema = v.strictObject({
  session: sessionSchema,
  token: v.pipe(v.string(), v.minLength(1)),
})

export type SessionCredentialResponse = v.InferOutput<typeof sessionCredentialResponseSchema>
