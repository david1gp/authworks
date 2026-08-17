import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function projectRoleKeysEncode(roleKeys: readonly string[]): Result<string> {
  const op = "projectRoleKeysEncode"
  if (roleKeys.some((key) => key.length === 0 || key.length > 200))
    return resultErrorCreate(op, "Project role keys are invalid.")
  if (new Set(roleKeys).size !== roleKeys.length) return resultErrorCreate(op, "Project role keys must be unique.")
  try {
    return resultCreate(JSON.stringify(roleKeys))
  } catch (_error) {
    return resultErrorCreate(op, "Project role keys could not be stored.")
  }
}
