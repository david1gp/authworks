import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { sessionSchema } from "./sessionSchema.js"

export const sessionListResponseSchema = listResponseSchemaCreate(sessionSchema)

export type SessionListResponse = v.InferOutput<typeof sessionListResponseSchema>
