import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { externalIdentitySchema } from "./externalIdentitySchema.js"

export const externalIdentityListResponseSchema = listResponseSchemaCreate(externalIdentitySchema)

export type ExternalIdentityListResponse = v.InferOutput<typeof externalIdentityListResponseSchema>
