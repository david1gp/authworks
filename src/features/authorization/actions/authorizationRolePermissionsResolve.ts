import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { authorizationFixedRoleDefinitions } from "../domain/authorizationFixedRoleDefinitions.js"
import { type AuthorizationPolicyRule, authorizationPolicyRuleSchema } from "../public/authorizationPolicyRuleSchema.js"
import {
  type AuthorizationRoleDefinition,
  authorizationRoleDefinitionSchema,
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
    if (!parsed.success)
      return resultErrorCodedCreate(op, "The custom role definition is invalid.", "authorization.invalid")
    if (definitions.has(parsed.output.roleId))
      return resultErrorCodedCreate(op, "The role is defined more than once.", "authorization.conflict")
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
  if (!parsed.success) return resultErrorCodedCreate(op, "The role permissions are invalid.", "authorization.invalid")
  return resultCreate(parsed.output)
}
