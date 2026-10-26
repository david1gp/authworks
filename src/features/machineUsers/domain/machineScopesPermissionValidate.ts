import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"

const machineScopeCatalog = new Set<string>(Object.values(authorizationPermissionDefinitions))

export function machineScopesPermissionValidate(scopes: readonly string[]): Result<readonly string[]> {
  const op = "machineScopesPermissionValidate"
  if (scopes.some((scope) => !machineScopeCatalog.has(scope)))
    return resultErrorCreate(op, "The requested machine scopes are invalid.", "machine-users.invalid-scope")
  return resultCreate(scopes)
}
