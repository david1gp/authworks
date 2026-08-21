import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { sessionMeSchema } from "./sessionMeSchema.js"

export const sessionMeListResponseSchema = listResponseSchemaCreate(sessionMeSchema)

export type SessionMeListResponse = v.InferOutput<typeof sessionMeListResponseSchema>
