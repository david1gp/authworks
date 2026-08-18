import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function projectRoleKeysEncode(roleKeys: readonly string[]): Result<string> {
  const op = "projectRoleKeysEncode"
  if (roleKeys.some((key) => key.length === 0 || key.length > 200))
    return resultErrorCodedCreate(op, "Project role keys are invalid.", "projects.role-keys-invalid")
  if (new Set(roleKeys).size !== roleKeys.length)
    return resultErrorCodedCreate(op, "Project role keys must be unique.", "projects.role-keys-duplicate")
  try {
    return resultCreate(JSON.stringify(roleKeys))
  } catch (_error) {
    return resultErrorCodedCreate(op, "Project role keys could not be stored.", "projects.write-failed")
  }
}
