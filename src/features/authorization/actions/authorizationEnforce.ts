import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { authorizationPolicyEvaluate } from "./authorizationPolicyEvaluate.js"
import type { AuthorizationActorContext } from "../public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../public/authorizationPermissionSchema.js"
import type { AuthorizationPolicyRule } from "../public/authorizationPolicyRuleSchema.js"
import type { AuthorizationRoleDefinition } from "../public/authorizationRoleDefinitionSchema.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"

type AuthorizationEnforceOptions = {
  readonly actor: AuthorizationActorContext
  readonly customRoles?: readonly AuthorizationRoleDefinition[]
  readonly instanceId: string
  readonly organizationId?: string
  readonly permission: AuthorizationPermission
  readonly minimumAssurance?: SessionAssurance
  readonly policies?: readonly AuthorizationPolicyRule[]
  readonly resourceId?: string
  readonly roles?: readonly string[]
}

export function authorizationEnforce(options: AuthorizationEnforceOptions): Result<void> {
  const op = "authorizationEnforce"
  const decision = authorizationPolicyEvaluate(options)
  if (!decision.success) return decision
  if (decision.data.allowed) return resultCreate(undefined)
  if (decision.data.reason === "anonymous") return resultErrorCreate(op, "Authentication is required.")
  if (decision.data.reason === "tenant_mismatch")
    return resultErrorCreate(op, "The actor is not available in this tenant context.")
  if (decision.data.reason === "organization_mismatch")
    return resultErrorCreate(op, "The actor is not available in this organization context.")
  if (decision.data.reason === "insufficient_assurance")
    return resultErrorCreate(op, "A stronger authentication is required.")
  return resultErrorCreate(op, "The actor is not authorized for this permission.")
}
