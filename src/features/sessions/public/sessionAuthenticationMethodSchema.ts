import * as v from "valibot"

export const sessionAuthenticationMethodSchema = v.picklist(["password"])

export type SessionAuthenticationMethod = v.InferOutput<typeof sessionAuthenticationMethodSchema>
