import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"

const eventListFilterSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256))

export const eventListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  actorId: v.optional(eventListFilterSchema),
  aggregateId: v.optional(eventListFilterSchema),
  aggregateType: v.optional(eventListFilterSchema),
  eventType: v.optional(eventListFilterSchema),
  occurredFrom: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  occurredTo: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  userSubjectId: v.optional(eventListFilterSchema),
})

export type EventListQuery = v.InferOutput<typeof eventListQuerySchema>
