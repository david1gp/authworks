import * as v from "valibot"

export const oidcClientStatusSchema = v.picklist(["active", "inactive", "removed"])

export type OidcClientStatus = v.InferOutput<typeof oidcClientStatusSchema>
