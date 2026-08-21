import type { StorageEvent } from "../../../platform/storage/storageEventTable.js"
import type { Event } from "../public/eventSchema.js"
import { eventPayloadRedact } from "./eventPayloadRedact.js"

export function eventPublicViewCreate(event: StorageEvent): Event {
  return {
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    aggregateVersion: event.aggregateVersion,
    correlationId: event.correlationId,
    eventType: event.eventType,
    id: event.id,
    metadata: eventPayloadRedact(event.metadata),
    occurredAt: event.occurredAt,
    payload: eventPayloadRedact(event.payload),
    realmId: event.realmId,
    ...(event.actorId === null ? {} : { actorId: event.actorId }),
    ...(event.causationId === null ? {} : { causationId: event.causationId }),
  }
}
