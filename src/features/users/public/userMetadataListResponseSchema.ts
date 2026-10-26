import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { userMetadataSchema } from "./userMetadataSchema.js"

export const userMetadataListResponseSchema = listResponseSchemaCreate(userMetadataSchema)

export type UserMetadataListResponse = v.InferOutput<typeof userMetadataListResponseSchema>
