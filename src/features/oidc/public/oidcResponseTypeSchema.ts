import * as v from "valibot"

export const oidcResponseTypeSchema = v.literal("code")

export type OidcResponseType = v.InferOutput<typeof oidcResponseTypeSchema>
