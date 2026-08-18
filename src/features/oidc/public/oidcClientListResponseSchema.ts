import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { oidcClientSchema } from "./oidcClientSchema.js"

export const oidcClientListResponseSchema = listResponseSchemaCreate(oidcClientSchema)

export type OidcClientListResponse = v.InferOutput<typeof oidcClientListResponseSchema>
