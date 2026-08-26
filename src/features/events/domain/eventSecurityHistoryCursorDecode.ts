import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const eventSecurityHistoryCursorSchema = v.strictObject({
  position: v.pipe(v.number(), v.integer(), v.minValue(1)),
  version: v.literal(1),
})

export function eventSecurityHistoryCursorDecode(token: string): Result<number> {
  const op = "eventSecurityHistoryCursorDecode"
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(token))
      return resultErrorCreate(op, "The security history cursor is invalid.", "events.invalid")
    const parsed = v.safeParse(
      eventSecurityHistoryCursorSchema,
      JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
    )
    if (!parsed.success) return resultErrorCreate(op, "The security history cursor is invalid.", "events.invalid")
    return resultCreate(parsed.output.position)
  } catch (_error) {
    return resultErrorCreate(op, "The security history cursor is invalid.", "events.invalid")
  }
}
