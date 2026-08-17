import * as v from "valibot"

export const sessionAuthenticationMethodSchema = v.picklist(["email_otp", "password"])

export type SessionAuthenticationMethod = v.InferOutput<typeof sessionAuthenticationMethodSchema>
