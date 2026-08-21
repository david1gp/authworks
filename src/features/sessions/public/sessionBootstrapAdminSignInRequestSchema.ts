import * as v from "valibot"

export const sessionBootstrapAdminSignInRequestSchema = v.strictObject({
  secret: v.pipe(v.string(), v.minLength(32)),
})

export type SessionBootstrapAdminSignInRequest = v.InferOutput<typeof sessionBootstrapAdminSignInRequestSchema>
