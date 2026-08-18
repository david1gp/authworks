import * as v from "valibot"

export const oidcClientTypeSchema = v.picklist(["public", "confidential"])

export type OidcClientType = v.InferOutput<typeof oidcClientTypeSchema>
