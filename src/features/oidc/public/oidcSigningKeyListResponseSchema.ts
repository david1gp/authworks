import * as v from "valibot"
import { oidcSigningKeySchema } from "./oidcSigningKeySchema.js"

export const oidcSigningKeyListResponseSchema = v.strictObject({ signingKeys: v.array(oidcSigningKeySchema) })

export type OidcSigningKeyListResponse = v.InferOutput<typeof oidcSigningKeyListResponseSchema>
