import * as v from "valibot"

export const eventSchema = v.strictObject({
  actorId: v.optional(v.pipe(v.string(), v.minLength(1))),
  aggregateId: v.pipe(v.string(), v.minLength(1)),
  aggregateType: v.pipe(v.string(), v.minLength(1)),
  aggregateVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  causationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  correlationId: v.pipe(v.string(), v.minLength(1)),
  eventType: v.pipe(v.string(), v.minLength(1)),
  id: v.pipe(v.string(), v.minLength(1)),
  metadata: v.unknown(),
  occurredAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  payload: v.unknown(),
  realmId: v.pipe(v.string(), v.minLength(1)),
})

export type Event = v.InferOutput<typeof eventSchema>
