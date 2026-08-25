import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { oidcRefreshTokenMetadataSchema } from "./oidcRefreshTokenMetadataSchema.js"

export const oidcRefreshTokenListResponseSchema = listResponseSchemaCreate(oidcRefreshTokenMetadataSchema)

export type OidcRefreshTokenListResponse = v.InferOutput<typeof oidcRefreshTokenListResponseSchema>
