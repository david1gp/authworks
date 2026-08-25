import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { sessionRecentSchema } from "./sessionRecentSchema.js"

export const sessionRecentListResponseSchema = listResponseSchemaCreate(sessionRecentSchema)

export type SessionRecentListResponse = v.InferOutput<typeof sessionRecentListResponseSchema>
