import * as v from "valibot"
import { eventSecurityHistoryCategorySchema } from "./eventSecurityHistoryCategorySchema.js"
import { eventSecurityHistoryDisplayCodeSchema } from "./eventSecurityHistoryDisplayCodeSchema.js"

export const eventSecurityHistoryItemSchema = v.strictObject({
  category: eventSecurityHistoryCategorySchema,
  displayCode: eventSecurityHistoryDisplayCodeSchema,
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  occurredAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type EventSecurityHistoryItem = v.InferOutput<typeof eventSecurityHistoryItemSchema>
