import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

const projectRoleKeysSchema = v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))

export function projectRoleKeysDecode(input: string): Result<string[]> {
  const op = "projectRoleKeysDecode"
  try {
    const parsed = v.safeParse(projectRoleKeysSchema, JSON.parse(input))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate(op, "The stored project role keys are invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate(op, "The stored project role keys are invalid.")
  }
}
