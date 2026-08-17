import * as v from "valibot"
import { oidcSigningKeySchema } from "./oidcSigningKeySchema.js"

export const oidcSigningKeyResponseSchema = v.strictObject({ signingKey: oidcSigningKeySchema })

export type OidcSigningKeyResponse = v.InferOutput<typeof oidcSigningKeyResponseSchema>
