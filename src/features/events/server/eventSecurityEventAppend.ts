import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { storageEventAppend, type StorageEventInput } from "../../../platform/storage/storageEventAppend.js"
import type { StorageEvent } from "../../../platform/storage/storageEventTable.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventDefinitionByType } from "../domain/eventSecurityEventDefinitionByType.js"
import { eventUserSubjectTable } from "../persistence/eventUserSubjectTable.js"

type EventSecurityEventInput = StorageEventInput & {
  readonly userSubjectId: string
}

export function eventSecurityEventAppend(
  database: StorageTransaction,
  input: EventSecurityEventInput,
  runtime?: Parameters<typeof storageEventAppend>[2],
): Result<StorageEvent> {
  const op = "eventSecurityEventAppend"
  if (typeof input.eventType !== "string" || !Object.hasOwn(eventSecurityEventDefinitionByType, input.eventType))
    return resultErrorCreate(op, "The event is not covered by the security-event allowlist.", "events.invalid")
  const definition =
    eventSecurityEventDefinitionByType[input.eventType as keyof typeof eventSecurityEventDefinitionByType]
  if (typeof input.userSubjectId !== "string" || input.userSubjectId.trim().length === 0)
    return resultErrorCreate(op, "A user subject is required for the covered event.", "events.invalid")

  const event = storageEventAppend(database, eventInputStripSubject(input), runtime)
  if (!event.success) return event
  try {
    database
      .insert(eventUserSubjectTable)
      .values({
        category: definition.category,
        displayCode: definition.displayCode,
        eventPosition: event.data.position,
        eventType: input.eventType,
        realmId: input.realmId,
        userId: input.userSubjectId,
      })
      .run()
    return event
  } catch (_error) {
    return resultErrorCreate(op, "The event subject could not be indexed.", "events.write-failed")
  }
}

function eventInputStripSubject(input: EventSecurityEventInput): StorageEventInput {
  const { userSubjectId: _userSubjectId, ...event } = input
  return event
}
