import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { eventSchema } from "./eventSchema.js"

export const eventListResponseSchema = listResponseSchemaCreate(eventSchema)

export type EventListResponse = v.InferOutput<typeof eventListResponseSchema>
