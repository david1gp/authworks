import { eventPayloadRedact } from "../../events/domain/eventPayloadRedact.js"

/** Redacts an audit payload again in the browser so no stored secret is ever rendered. */
export function adminEventPayloadDisplay(payload: unknown): string {
  const redacted = eventPayloadRedact(payload)
  if (redacted === undefined) return "null"
  try {
    return JSON.stringify(redacted, null, 2) ?? String(redacted)
  } catch (_error) {
    return String(redacted)
  }
}
