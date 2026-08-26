import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { accountSecurityHistoryItemSchema } from "./accountSecurityHistoryItemSchema.js"

export const accountSecurityHistoryListResponseSchema = listResponseSchemaCreate(accountSecurityHistoryItemSchema)

export type AccountSecurityHistoryListResponse = v.InferOutput<typeof accountSecurityHistoryListResponseSchema>
