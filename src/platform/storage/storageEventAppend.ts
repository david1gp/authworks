import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import { uuidv7Create } from "../ids/uuidv7Create.js"
import { runtimeCreate } from "../runtime/runtimeCreate.js"
import { storageJsonEncode } from "./storageJsonEncode.js"
import { storageEventTable, type StorageEvent } from "./storageEventTable.js"
import type { StorageExecutor } from "./storageSchema.js"

export type StorageEventInput = {
  actorId?: string | null
  aggregateId: string
  aggregateType: string
  aggregateVersion: number
  causationId?: string | null
  commandIndex: number
  correlationId: string
  eventId?: string
  eventType: string
  id?: string
  realmId: string
  metadata: unknown
  occurredAt?: number
  payload: unknown
}

export function storageEventAppend(
  database: StorageExecutor,
  input: StorageEventInput,
  runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes"> = runtimeCreate(),
): Result<StorageEvent> {
  const op = "storageEventAppend"
  if (input.realmId.length === 0 || input.aggregateType.length === 0 || input.aggregateId.length === 0) {
    return resultErrorCreate(op, "Event realm and aggregate identity are required.")
  }
  if (input.eventType.length === 0 || input.correlationId.length === 0)
    return resultErrorCreate(op, "Event type and correlation identity are required.")
  if (!Number.isSafeInteger(input.commandIndex) || input.commandIndex < 0)
    return resultErrorCreate(op, "The event command index must be a non-negative integer.")
  if (!Number.isSafeInteger(input.aggregateVersion) || input.aggregateVersion < 1)
    return resultErrorCreate(op, "The event aggregate version must be a positive integer.")

  const occurredAt = input.occurredAt ?? runtime.now()
  if (!Number.isSafeInteger(occurredAt) || occurredAt < 0)
    return resultErrorCreate(op, "The event timestamp must be a non-negative integer.")

  try {
    const eventId = input.id ?? input.eventId ?? uuidv7Create(runtime)
    if (input.id !== undefined && input.eventId !== undefined && input.id !== input.eventId)
      return resultErrorCreate(op, "The event identifiers must match.")
    if (!storageEventIdIsCanonical(eventId)) return resultErrorCreate(op, "The event ID must be a lowercase UUIDv7.")

    const payload = storageJsonEncode(input.payload)
    if (!payload.success) return payload
    const metadata = storageJsonEncode(input.metadata)
    if (!metadata.success) return metadata

    const event = database
      .insert(storageEventTable)
      .values({
        actorId: input.actorId ?? null,
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        aggregateVersion: input.aggregateVersion,
        causationId: input.causationId ?? null,
        commandIndex: input.commandIndex,
        correlationId: input.correlationId,
        eventType: input.eventType,
        id: eventId,
        realmId: input.realmId,
        metadata: metadata.data,
        occurredAt,
        payload: payload.data,
      })
      .returning()
      .get()
    if (event === undefined) return resultErrorCreate(op, "The event could not be appended.")
    return resultCreate(event)
  } catch (_error) {
    return resultErrorCreate(op, "The event could not be appended.")
  }
}

function storageEventIdIsCanonical(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}
