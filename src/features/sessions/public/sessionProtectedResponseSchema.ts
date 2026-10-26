import * as v from "valibot"
import { authorizationActorContextSchema } from "../../authorization/public/authorizationActorContextSchema.js"
import { sessionSchema } from "./sessionSchema.js"

export const sessionProtectedResponseSchema = v.strictObject({
  actor: authorizationActorContextSchema,
  session: sessionSchema,
})

export type SessionProtectedResponse = v.InferOutput<typeof sessionProtectedResponseSchema>
