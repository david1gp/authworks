import * as v from "valibot"
import { oidcClientSchema } from "./oidcClientSchema.js"

export const oidcClientResponseSchema = v.strictObject({ client: oidcClientSchema })

export type OidcClientResponse = v.InferOutput<typeof oidcClientResponseSchema>
