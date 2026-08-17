import * as v from "valibot"
import { oidcClientSchema } from "./oidcClientSchema.js"

export const oidcClientListResponseSchema = v.strictObject({ clients: v.array(oidcClientSchema) })

export type OidcClientListResponse = v.InferOutput<typeof oidcClientListResponseSchema>
