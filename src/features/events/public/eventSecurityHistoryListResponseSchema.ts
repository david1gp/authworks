import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { eventSecurityHistoryItemSchema } from "./eventSecurityHistoryItemSchema.js"

export const eventSecurityHistoryListResponseSchema = listResponseSchemaCreate(eventSecurityHistoryItemSchema)

export type EventSecurityHistoryListResponse = v.InferOutput<typeof eventSecurityHistoryListResponseSchema>
