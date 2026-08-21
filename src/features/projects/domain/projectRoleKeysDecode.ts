import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const projectRoleKeysSchema = v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200)))

export function projectRoleKeysDecode(input: string): Result<string[]> {
  const op = "projectRoleKeysDecode"
  try {
    const parsed = v.safeParse(projectRoleKeysSchema, JSON.parse(input))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCodedCreate(op, "The stored project role keys are invalid.", "projects.role-keys-invalid")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The stored project role keys are invalid.", "projects.role-keys-invalid")
  }
}
