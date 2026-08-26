import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { storageEventAppend, type StorageEventInput } from "../../../platform/storage/storageEventAppend.js"
import type { StorageEvent } from "../../../platform/storage/storageEventTable.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"

type EventSecurityUnindexedEventInput = StorageEventInput & {
  readonly unindexedReason: "anonymous_passkey_authentication" | "bootstrap_admin_session"
}

const eventSecurityUnindexedEventTypeByReason = {
  anonymous_passkey_authentication: ["passkey.authentication_started"],
  bootstrap_admin_session: ["session.created", "session.revoked", "session.revoked_all", "session.rotated"],
} as const

export function eventSecurityUnindexedEventAppend(
  database: StorageTransaction,
  input: EventSecurityUnindexedEventInput,
  runtime?: Parameters<typeof storageEventAppend>[2],
): Result<StorageEvent> {
  const op = "eventSecurityUnindexedEventAppend"
  const allowedEventTypes = eventSecurityUnindexedEventTypeByReason[input.unindexedReason]
  if (allowedEventTypes === undefined || !allowedEventTypes.some((eventType) => eventType === input.eventType))
    return resultErrorCreate(op, "The event is not valid for an unindexed security append.", "events.invalid")
  const { unindexedReason: _unindexedReason, ...event } = input
  return storageEventAppend(database, event, runtime)
}
