import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCodedCreate } from "../errors/resultErrorCodedCreate.js"
import { listCursorPayloadSchema } from "./listCursorPayloadSchema.js"

export function listCursorDecode(token: string): Result<{ id: string; k: string | number }> {
  const op = "listCursorDecode"
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(token))
      return resultErrorCodedCreate(op, "The list cursor is invalid.", "platform.invalid-cursor")
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"))
    const parsed = v.safeParse(listCursorPayloadSchema, payload)
    if (!parsed.success) return resultErrorCodedCreate(op, "The list cursor is invalid.", "platform.invalid-cursor")
    return resultCreate({ id: parsed.output.id, k: parsed.output.k })
  } catch (_error) {
    return resultErrorCodedCreate(op, "The list cursor is invalid.", "platform.invalid-cursor")
  }
}
