import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { oidcSigningKeySchema } from "./oidcSigningKeySchema.js"

export const oidcSigningKeyListResponseSchema = listResponseSchemaCreate(oidcSigningKeySchema)

export type OidcSigningKeyListResponse = v.InferOutput<typeof oidcSigningKeyListResponseSchema>
