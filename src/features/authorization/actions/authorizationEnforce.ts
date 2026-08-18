import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { authorizationPolicyEvaluate } from "./authorizationPolicyEvaluate.js"
import type { AuthorizationActorContext } from "../public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../public/authorizationPermissionSchema.js"
import type { AuthorizationPolicyRule } from "../public/authorizationPolicyRuleSchema.js"
import type { AuthorizationRoleDefinition } from "../public/authorizationRoleDefinitionSchema.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"

type AuthorizationEnforceOptions = {
  readonly actor: AuthorizationActorContext
  readonly customRoles?: readonly AuthorizationRoleDefinition[]
  readonly realmId: string
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
  if (decision.data.reason === "anonymous")
    return resultErrorCodedCreate(op, "Authentication is required.", "authorization.authentication-required")
  if (decision.data.reason === "tenant_mismatch")
    return resultErrorCodedCreate(
      op,
      "The actor is not available in this tenant context.",
      "authorization.tenant-mismatch",
    )
  if (decision.data.reason === "organization_mismatch")
    return resultErrorCodedCreate(
      op,
      "The actor is not available in this organization context.",
      "authorization.tenant-mismatch",
    )
  if (decision.data.reason === "insufficient_assurance")
    return resultErrorCodedCreate(op, "A stronger authentication is required.", "authorization.insufficient-assurance")
  if (decision.data.reason === "impersonation_limit")
    return resultErrorCodedCreate(
      op,
      "The impersonated session is not allowed to use this permission.",
      "authorization.impersonation-forbidden",
    )
  return resultErrorCodedCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")
}
