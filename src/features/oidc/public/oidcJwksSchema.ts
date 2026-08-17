import * as v from "valibot"
import { oidcPublicJwkSchema } from "./oidcPublicJwkSchema.js"

export const oidcJwksSchema = v.strictObject({ keys: v.array(oidcPublicJwkSchema) })

export type OidcJwks = v.InferOutput<typeof oidcJwksSchema>
