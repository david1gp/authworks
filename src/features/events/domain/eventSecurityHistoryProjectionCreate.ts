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
  readonly payload?: unknown
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
    ...eventSecurityHistoryLocationGet(input.payload),
  })
}

function eventSecurityHistoryLocationGet(
  payload: unknown,
): Pick<EventSecurityHistoryItem, "countryCode" | "ipAddress" | "region"> {
  if (payload === null || typeof payload !== "object") return {}
  const device = (payload as { readonly device?: unknown }).device
  if (device === null || typeof device !== "object") return {}
  const fields = device as Record<string, unknown>
  const countryCode = eventSecurityHistoryDeviceFieldGet(fields["countryCode"])
  const ipAddress = eventSecurityHistoryDeviceFieldGet(fields["ipAddress"])
  const region = eventSecurityHistoryDeviceFieldGet(fields["region"])
  return {
    ...(countryCode === undefined ? {} : { countryCode }),
    ...(ipAddress === undefined ? {} : { ipAddress }),
    ...(region === undefined ? {} : { region }),
  }
}

function eventSecurityHistoryDeviceFieldGet(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined
  return value
}
