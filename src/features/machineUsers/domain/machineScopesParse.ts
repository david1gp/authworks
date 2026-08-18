import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { machineScopeSchema } from "../public/machineScopeSchema.js"

export function machineScopesParse(value: string): Result<string[]> {
  const op = "machineScopesParse"
  try {
    const parsed = v.safeParse(v.pipe(v.array(machineScopeSchema), v.maxLength(100)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate(op, "The machine scopes are invalid.", "machine-users.invalid-scope")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate(op, "The machine scopes are invalid.", "machine-users.invalid-scope")
  }
}
