import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { oidcConsentSchema } from "./oidcConsentSchema.js"

export const oidcConsentListResponseSchema = listResponseSchemaCreate(oidcConsentSchema)

export type OidcConsentListResponse = v.InferOutput<typeof oidcConsentListResponseSchema>
