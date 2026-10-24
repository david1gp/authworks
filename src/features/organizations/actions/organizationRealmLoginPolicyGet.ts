import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { realmAdministratorIs } from "../../realms/server/realmAdministratorIs.js"
import { organizationLoginPolicyOverrideViewCreate } from "../domain/organizationLoginPolicyOverrideViewCreate.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import { organizationLoginPolicyResolve } from "./organizationLoginPolicyResolve.js"

type OrganizationRealmLoginPolicyGetOptions = {
  readonly context?: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function organizationRealmLoginPolicyGet(
  options: OrganizationRealmLoginPolicyGetOptions,
): Result<OrganizationLoginPolicyResponse> {
  if (options.context !== undefined) {
    if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
      return resultErrorCodedCreate(
        "organizationRealmLoginPolicyGet",
        "The login policy is not available in this tenant context.",
        "organizations.tenant-mismatch",
      )
    // Realm admins keep working through the tenant check below. Active owners/admins of any
    // active organization in the realm may additionally read the realm default login policy, which
    // the configuration screen needs for inheritance display. Tenant mismatch is checked first so
    // `owned` only inspects memberships when the realm matches.
    const owned = organizationRealmPolicyTenantReadAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
    })
    if (!owned.success) return owned
    return organizationRealmLoginPolicyGetResult(options)
  }
  return organizationRealmLoginPolicyGetResult(options)
}

/** Reads the realm default login policy without any authorization check (callers authorize first). */
function organizationRealmLoginPolicyGetResult(
  options: OrganizationRealmLoginPolicyGetOptions,
): Result<OrganizationLoginPolicyResponse> {
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success) return policy
  const override = organizationLoginPolicyRepositoryCreate(options.database.db).realmLoginPolicyGet(options.realmId)
  if (!override.success) return override
  const overrides = organizationLoginPolicyOverrideViewCreate(override.data)
  if (!overrides.success) return overrides
  return resultCreate({
    realmId: options.realmId,
    organizationId: null,
    overrides: overrides.data,
    policy: policy.data,
  })
}

/**
 * Allows the realm default login policy read for realm administrators and for active
 * owners/admins of any active organization in the realm.
 */
function organizationRealmPolicyTenantReadAuthorize(options: {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}): Result<void> {
  const op = "organizationRealmLoginPolicyGet"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.actor.kind !== "user")
    return resultErrorCodedCreate(
      op,
      "The actor is not authorized to read the realm login policy.",
      "organizations.forbidden",
    )
  if (options.context.kind === "tenant") {
    const administrator = realmAdministratorIs({
      database: options.database,
      realmId: options.realmId,
      userId: options.context.actorId,
    })
    if (!administrator.success) return administrator
    if (administrator.data) return resultCreate(undefined)
  }
  const repository = organizationRepositoryCreate(options.database.db)
  const memberships = repository.organizationMembershipListByRealmUser(options.realmId, options.context.actorId)
  if (!memberships.success) return memberships
  for (const membership of memberships.data) {
    const organization = repository.organizationGet(membership.organizationId)
    if (!organization.success) return organization
    if (organization.data === null || organization.data.realmId !== options.realmId) continue
    if (organization.data.status !== "active") continue
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    if (roles.data.includes("owner") || roles.data.includes("admin")) return resultCreate(undefined)
  }
  return resultErrorCodedCreate(
    op,
    "The actor is not authorized to read the realm login policy.",
    "organizations.forbidden",
  )
}
