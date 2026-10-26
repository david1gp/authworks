import * as v from "valibot"
import type { EventListQuery } from "../../events/public/eventListQuerySchema.js"

const eventFilterValueSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(256))
const eventFilterDateSchema = v.pipe(v.string(), v.trim(), v.regex(/^\d{4}-\d{2}-\d{2}$/))

export const adminEventFiltersSchema = v.strictObject({
  actorId: v.optional(eventFilterValueSchema),
  aggregateId: v.optional(eventFilterValueSchema),
  aggregateType: v.optional(eventFilterValueSchema),
  eventType: v.optional(eventFilterValueSchema),
  occurredFrom: v.optional(eventFilterDateSchema),
  occurredTo: v.optional(eventFilterDateSchema),
  userSubjectId: v.optional(eventFilterValueSchema),
})

export type AdminEventFilters = v.InferOutput<typeof adminEventFiltersSchema>

export type AdminEventFilterKey = keyof AdminEventFilters

/** Validated URL state for the audit-event filters; unknown or absent params fall back to empty. */
export function adminEventFiltersParse(search: string): AdminEventFilters {
  const params = new URLSearchParams(search)
  const parsed = v.safeParse(adminEventFiltersSchema, {
    actorId: params.get("actorId") ?? undefined,
    aggregateId: params.get("aggregateId") ?? undefined,
    aggregateType: params.get("aggregateType") ?? undefined,
    eventType: params.get("eventType") ?? undefined,
    occurredFrom: params.get("occurredFrom") ?? undefined,
    occurredTo: params.get("occurredTo") ?? undefined,
    userSubjectId: params.get("userSubjectId") ?? undefined,
  })
  if (!parsed.success) return {}
  return parsed.output
}

/** Serializes URL-held filters into the server event list query. Invalid dates are dropped. */
export function adminEventFiltersToQuery(filters: AdminEventFilters): EventListQuery {
  const query: {
    actorId?: string
    aggregateId?: string
    aggregateType?: string
    eventType?: string
    occurredFrom?: number
    occurredTo?: number
    userSubjectId?: string
  } = {}
  if (filters.actorId !== undefined) query.actorId = filters.actorId
  if (filters.aggregateId !== undefined) query.aggregateId = filters.aggregateId
  if (filters.aggregateType !== undefined) query.aggregateType = filters.aggregateType
  if (filters.eventType !== undefined) query.eventType = filters.eventType
  if (filters.userSubjectId !== undefined) query.userSubjectId = filters.userSubjectId
  if (filters.occurredFrom !== undefined) {
    const from = Date.parse(`${filters.occurredFrom}T00:00:00.000Z`)
    if (!Number.isNaN(from)) query.occurredFrom = from
  }
  if (filters.occurredTo !== undefined) {
    // The server bound is inclusive, so the selected day counts in full.
    const start = Date.parse(`${filters.occurredTo}T00:00:00.000Z`)
    if (!Number.isNaN(start)) query.occurredTo = start + 86_400_000 - 1
  }
  return query
}
