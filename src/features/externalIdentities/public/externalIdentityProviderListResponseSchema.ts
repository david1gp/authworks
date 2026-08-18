import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { externalIdentityProviderSchema } from "./externalIdentityProviderSchema.js"

export const externalIdentityProviderListResponseSchema = listResponseSchemaCreate(externalIdentityProviderSchema)

export type ExternalIdentityProviderListResponse = v.InferOutput<typeof externalIdentityProviderListResponseSchema>
