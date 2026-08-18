import * as v from "valibot"
import { oidcClientStatusSchema } from "./oidcClientStatusSchema.js"

export const oidcClientLifecycleRequestSchema = v.strictObject({ status: oidcClientStatusSchema })

export type OidcClientLifecycleRequest = v.InferOutput<typeof oidcClientLifecycleRequestSchema>
