import * as v from "valibot"
import { eventSchema } from "./eventSchema.js"

export const eventExportResponseSchema = v.strictObject({
  items: v.array(eventSchema),
  truncated: v.boolean(),
})

export type EventExportResponse = v.InferOutput<typeof eventExportResponseSchema>
