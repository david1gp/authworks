import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { authorizationFixedRoleDefinitions } from "../domain/authorizationFixedRoleDefinitions.js"
import type { AuthorizationResolvedAccess } from "../public/authorizationResolvedAccessSchema.js"
import type { AuthorizationRoleDefinition } from "../public/authorizationRoleDefinitionSchema.js"
import { authorizationRoleDefinitionSchema } from "../public/authorizationRoleDefinitionSchema.js"
import { authorizationRolePermissionsResolve } from "./authorizationRolePermissionsResolve.js"

type AuthorizationRoleKeysResolveOptions = {
  readonly customRoles?: readonly AuthorizationRoleDefinition[]
  readonly roles: readonly string[]
}

export function authorizationRoleKeysResolve(
  options: AuthorizationRoleKeysResolveOptions,
): Result<AuthorizationResolvedAccess> {
  const resolved = authorizationRolePermissionsResolve(options)
  if (!resolved.success) return resolved

  const roleDefinitions = new Set(authorizationFixedRoleDefinitions.map((definition) => definition.roleId))
  for (const customRole of options.customRoles ?? []) {
    const parsed = v.safeParse(authorizationRoleDefinitionSchema, customRole)
    if (!parsed.success) continue
    roleDefinitions.add(parsed.output.roleId)
  }
  const roleKeys = [...new Set(options.roles)].filter((role) => roleDefinitions.has(role)).sort()
  const denied = new Set(resolved.data.filter((rule) => rule.effect === "deny").map((rule) => rule.permission))
  const permissions = [
    ...new Set(
      resolved.data
        .filter((rule) => rule.effect === "allow" && !denied.has(rule.permission))
        .map((rule) => rule.permission),
    ),
  ].sort()
  return resultCreate({ permissions, roleKeys })
}
