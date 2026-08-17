import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { authorizationRolePermissionsResolve } from "./authorizationRolePermissionsResolve.js"
import type { AuthorizationActorContext } from "../public/authorizationActorContextSchema.js"
import { authorizationActorContextSchema } from "../public/authorizationActorContextSchema.js"
import type { AuthorizationDecision } from "../public/authorizationDecisionSchema.js"
import type { AuthorizationPermission } from "../public/authorizationPermissionSchema.js"
import { authorizationPermissionSchema } from "../public/authorizationPermissionSchema.js"
import type { AuthorizationPolicyRule } from "../public/authorizationPolicyRuleSchema.js"
import { authorizationPolicyRuleSchema } from "../public/authorizationPolicyRuleSchema.js"
import type { AuthorizationRoleDefinition } from "../public/authorizationRoleDefinitionSchema.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"

type AuthorizationPolicyEvaluateOptions = {
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

export function authorizationPolicyEvaluate(
  options: AuthorizationPolicyEvaluateOptions,
): Result<AuthorizationDecision> {
  const op = "authorizationPolicyEvaluate"
  const actor = v.safeParse(authorizationActorContextSchema, options.actor)
  if (!actor.success) return resultErrorCreate(op, "The actor context is invalid.")
  if (!authorizationActorContextIsConsistent(actor.output))
    return resultErrorCreate(op, "The actor context is invalid.")
  const permission = v.safeParse(authorizationPermissionSchema, options.permission)
  if (!permission.success) return resultErrorCreate(op, "The permission is invalid.")
  if (options.instanceId.length === 0) return resultErrorCreate(op, "The instance context is invalid.")
  if (options.resourceId !== undefined && options.resourceId.length === 0)
    return resultErrorCreate(op, "The resource context is invalid.")

  const baseDecision = (allowed: boolean, reason: AuthorizationDecision["reason"]): AuthorizationDecision => ({
    actorId: actor.output.actorId,
    allowed,
    instanceId: options.instanceId,
    ...(options.organizationId === undefined ? {} : { organizationId: options.organizationId }),
    permission: permission.output,
    reason,
    ...(options.resourceId === undefined ? {} : { resourceId: options.resourceId }),
  })

  if (actor.output.kind === "system") return resultCreate(baseDecision(true, "system"))
  if (actor.output.instanceId !== options.instanceId) return resultCreate(baseDecision(false, "tenant_mismatch"))
  if (actor.output.kind === "anonymous") return resultCreate(baseDecision(false, "anonymous"))
  if (actor.output.organizationId !== undefined && actor.output.organizationId !== options.organizationId)
    return resultCreate(baseDecision(false, "organization_mismatch"))
  if (actor.output.kind === "bootstrap_admin") return resultCreate(baseDecision(true, "bootstrap_admin"))
  if (actor.output.impersonatorId !== undefined && permission.output === "user.impersonate")
    return resultCreate(baseDecision(false, "impersonation_limit"))
  if (
    actor.output.impersonationPermissions !== undefined &&
    !actor.output.impersonationPermissions.includes(permission.output)
  )
    return resultCreate(baseDecision(false, "impersonation_limit"))
  if (actor.output.kind === "machine")
    return resultCreate(baseDecision(actor.output.scopes?.includes(permission.output) ?? false, "policy"))

  const roleRules = authorizationRolePermissionsResolve({
    customRoles: options.customRoles,
    roles: options.roles ?? [],
  })
  if (!roleRules.success) return roleRules
  const policies = options.policies ?? []
  for (const policy of policies) {
    const parsed = v.safeParse(authorizationPolicyRuleSchema, policy)
    if (!parsed.success) return resultErrorCreate(op, "The authorization policy is invalid.")
  }
  const rules = [...roleRules.data, ...policies]
  const matches = (rule: AuthorizationPolicyRule) => {
    if (rule.permission !== permission.output) return false
    if (options.resourceId !== undefined && rule.resourceId !== undefined && rule.resourceId !== options.resourceId)
      return false
    return assuranceIsSufficient(actor.output.assurance, options.minimumAssurance ?? rule.minimumAssurance)
  }
  if (rules.some((rule) => rule.effect === "deny" && matches(rule))) return resultCreate(baseDecision(false, "policy"))
  const matchingAllowIndex = rules.findIndex((rule) => rule.effect === "allow" && matches(rule))
  if (matchingAllowIndex === -1) {
    const hasResourceRule = rules.some((rule) => rule.permission === permission.output && rule.resourceId !== undefined)
    const hasInsufficientAssurance = rules.some(
      (rule) =>
        rule.effect === "allow" &&
        rule.permission === permission.output &&
        assuranceIsInsufficient(actor.output.assurance, options.minimumAssurance ?? rule.minimumAssurance),
    )
    if (hasInsufficientAssurance) return resultCreate(baseDecision(false, "insufficient_assurance"))
    return resultCreate(baseDecision(false, hasResourceRule ? "resource_mismatch" : "no_permission"))
  }
  return resultCreate(baseDecision(true, matchingAllowIndex >= roleRules.data.length ? "policy" : "role"))
}

function authorizationActorContextIsConsistent(actor: AuthorizationActorContext): boolean {
  if (
    actor.kind !== "user" &&
    (actor.impersonatorId !== undefined ||
      actor.impersonationSessionId !== undefined ||
      actor.impersonationPermissions !== undefined)
  )
    return false
  if (actor.kind === "system")
    return (
      actor.assurance === "authenticated" &&
      actor.authenticationMethod === "system" &&
      actor.instanceId === undefined &&
      actor.organizationId === undefined
    )
  if (actor.kind === "anonymous")
    return (
      actor.assurance === "none" &&
      actor.authenticationMethod === "none" &&
      actor.instanceId !== undefined &&
      actor.organizationId === undefined
    )
  if (actor.kind === "bootstrap_admin")
    return (
      actor.assurance === "authenticated" &&
      actor.authenticationMethod === "bootstrap_admin" &&
      actor.instanceId !== undefined &&
      actor.organizationId === undefined
    )
  if (actor.kind === "machine")
    return (
      actor.assurance === "authenticated" &&
      ["client_credentials", "personal_access_token", "api_key", "oidc_access_token"].includes(
        actor.authenticationMethod,
      ) &&
      actor.instanceId !== undefined &&
      actor.organizationId === undefined
    )
  if (
    actor.impersonatorId !== undefined &&
    (actor.impersonationSessionId === undefined ||
      actor.impersonationPermissions === undefined ||
      actor.impersonatorId === actor.actorId)
  )
    return false
  if (
    actor.impersonatorId === undefined &&
    (actor.impersonationSessionId !== undefined || actor.impersonationPermissions !== undefined)
  )
    return false
  return (
    (actor.assurance === "authenticated" || actor.assurance === "multi_factor") &&
    actor.authenticationMethod === "trusted" &&
    actor.instanceId !== undefined
  )
}

function assuranceIsInsufficient(
  current: AuthorizationActorContext["assurance"],
  required: SessionAssurance | undefined,
) {
  if (required === undefined) return false
  return assuranceRankGet(current) < assuranceRankGet(required)
}

function assuranceIsSufficient(
  current: AuthorizationActorContext["assurance"],
  required: SessionAssurance | undefined,
) {
  return !assuranceIsInsufficient(current, required)
}

function assuranceRankGet(assurance: SessionAssurance): number {
  if (assurance === "multi_factor") return 2
  if (assurance === "authenticated") return 1
  return 0
}
