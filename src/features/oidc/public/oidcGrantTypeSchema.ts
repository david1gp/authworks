import * as v from "valibot"

export const oidcGrantTypeSchema = v.picklist(["authorization_code", "refresh_token"])

export type OidcGrantType = v.InferOutput<typeof oidcGrantTypeSchema>
