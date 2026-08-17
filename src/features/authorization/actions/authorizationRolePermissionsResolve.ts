import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import * as v from "valibot"
import { authorizationFixedRoleDefinitions } from "../domain/authorizationFixedRoleDefinitions.js"
import { authorizationPolicyRuleSchema, type AuthorizationPolicyRule } from "../public/authorizationPolicyRuleSchema.js"
import {
  authorizationRoleDefinitionSchema,
  type AuthorizationRoleDefinition,
} from "../public/authorizationRoleDefinitionSchema.js"

type AuthorizationRolePermissionsResolveOptions = {
  readonly customRoles?: readonly AuthorizationRoleDefinition[]
  readonly roles: readonly string[]
}

export function authorizationRolePermissionsResolve(
  options: AuthorizationRolePermissionsResolveOptions,
): Result<AuthorizationPolicyRule[]> {
  const op = "authorizationRolePermissionsResolve"
  const definitions = new Map(authorizationFixedRoleDefinitions.map((definition) => [definition.roleId, definition]))
  for (const customRole of options.customRoles ?? []) {
    const parsed = v.safeParse(authorizationRoleDefinitionSchema, customRole)
    if (!parsed.success) return resultErrorCreate(op, "The custom role definition is invalid.")
    if (definitions.has(parsed.output.roleId)) return resultErrorCreate(op, "The role is defined more than once.")
    definitions.set(parsed.output.roleId, parsed.output)
  }
  const rules: AuthorizationPolicyRule[] = []
  for (const role of options.roles) {
    const definition = definitions.get(role)
    if (definition === undefined) continue
    for (const permission of definition.permissions) rules.push({ effect: "allow", permission })
    for (const permission of definition.deniedPermissions ?? []) rules.push({ effect: "deny", permission })
  }
  const parsed = v.safeParse(v.array(authorizationPolicyRuleSchema), rules)
  if (!parsed.success) return resultErrorCreate(op, "The role permissions are invalid.")
  return resultCreate(parsed.output)
}
