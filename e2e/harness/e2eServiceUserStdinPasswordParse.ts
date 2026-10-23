import * as v from "valibot"
import { createResult, createResultError, type Result } from "#result"

const stdinPasswordSchema = v.strictObject({
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
})

export function e2eServiceUserStdinPasswordParse(raw: string): Result<string> {
  const op = "e2eServiceUserStdinPasswordParse"
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createResultError(op, 'The stdin payload is not valid JSON. Expected {"password": "..."}.')
  }
  const validated = v.safeParse(stdinPasswordSchema, parsed)
  if (!validated.success) return createResultError(op, 'The stdin payload is invalid. Expected {"password": "..."}.')
  return createResult(validated.output.password)
}
