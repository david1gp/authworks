import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { EventSecurityHistoryItem } from "../public/eventSecurityHistoryItemSchema.js"
import { eventSecurityEventDefinitionByType } from "./eventSecurityEventDefinitionByType.js"

type EventSecurityHistoryProjectionInput = {
  readonly category: string
  readonly displayCode: string
  readonly eventType: string
  readonly id: string
  readonly occurredAt: number
}

export function eventSecurityHistoryProjectionCreate(input: EventSecurityHistoryProjectionInput) {
  const op = "eventSecurityHistoryProjectionCreate"
  if (!Object.hasOwn(eventSecurityEventDefinitionByType, input.eventType))
    return resultErrorCreate(op, "The event is not covered by the security-event allowlist.", "events.invalid")
  const definition =
    eventSecurityEventDefinitionByType[input.eventType as keyof typeof eventSecurityEventDefinitionByType]
  return resultCreate<EventSecurityHistoryItem>({
    category: definition.category,
    displayCode: definition.displayCode,
    id: input.id,
    occurredAt: input.occurredAt,
  })
}
