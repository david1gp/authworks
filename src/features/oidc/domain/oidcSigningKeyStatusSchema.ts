import * as v from "valibot"

export const oidcSigningKeyStatusSchema = v.picklist(["active", "retired"])

export type OidcSigningKeyStatus = v.InferOutput<typeof oidcSigningKeyStatusSchema>
