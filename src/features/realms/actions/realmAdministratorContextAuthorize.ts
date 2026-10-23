import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import { organizationMembershipAccessList } from "../../organizations/actions/organizationMembershipAccessList.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmAdministratorIs } from "../server/realmAdministratorIs.js"

type RealmAdministratorContextAuthorizeOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly minimumAssurance?: SessionAssurance
  readonly permission: AuthorizationPermission
  readonly realmId: string
  readonly targetUserId?: string
}

const organizationScopedPermissions: readonly AuthorizationPermission[] = [
  authorizationPermissionDefinitions.userRead,
  authorizationPermissionDefinitions.userManage,
  authorizationPermissionDefinitions.userImpersonate,
]

export function realmAdministratorContextAuthorize(
  options: RealmAdministratorContextAuthorizeOptions,
): Result<RealmTenantContext> {
  const op = "realmAdministratorContextAuthorize"
  if (options.actor.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The actor is not available in this tenant context.",
      "authorization.tenant-mismatch",
    )
  if (options.actor.kind === "bootstrap_admin") {
    if (
      options.minimumAssurance !== undefined &&
      assuranceRankGet(options.actor.assurance) < assuranceRankGet(options.minimumAssurance)
    )
      return resultErrorCodedCreate(
        op,
        "A stronger authentication is required.",
        "authorization.insufficient-assurance",
      )
    const authorized = authorizationEnforce({
      actor: options.actor,
      minimumAssurance: options.minimumAssurance,
      permission: options.permission,
      realmId: options.realmId,
    })
    if (!authorized.success) return authorized
    return resultCreate(realmTenantContextCreate(options.actor, options.realmId))
  }
  if (options.actor.kind !== "user")
    return resultErrorCodedCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")

  const administrator = realmAdministratorIs({
    database: options.database,
    realmId: options.realmId,
    userId: options.actor.actorId,
  })
  if (!administrator.success) return administrator
  if (administrator.data) {
    const authorized = authorizationEnforce({
      actor: options.actor,
      minimumAssurance: options.minimumAssurance,
      permission: options.permission,
      realmId: options.realmId,
      roles: ["realm_admin"],
    })
    if (!authorized.success) return authorized
    return resultCreate(realmTenantContextCreate(options.actor, options.realmId))
  }

  if (!organizationScopedPermissions.includes(options.permission) || options.actor.actorId.length === 0)
    return resultErrorCodedCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")
  if (options.targetUserId === undefined)
    return resultErrorCodedCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")

  if (options.targetUserId === options.actor.actorId) {
    const selfManaged = realmAdministratorManagedAccessResolve({
      actorId: options.actor.actorId,
      database: options.database,
      minimumAssurance: options.minimumAssurance,
      permission: options.permission,
      realmId: options.realmId,
      targetUserId: options.actor.actorId,
    })
    if (!selfManaged.success) return selfManaged
    const authorized = authorizationEnforce({
      actor: options.actor,
      minimumAssurance: options.minimumAssurance,
      organizationId: selfManaged.data.organizationId,
      permission: options.permission,
      realmId: options.realmId,
      roles: selfManaged.data.roles,
    })
    if (!authorized.success) return authorized
    return resultCreate(realmTenantContextCreate(options.actor, options.realmId))
  }

  const managed = realmAdministratorManagedAccessResolve({
    actorId: options.actor.actorId,
    database: options.database,
    minimumAssurance: options.minimumAssurance,
    permission: options.permission,
    realmId: options.realmId,
    targetUserId: options.targetUserId,
  })
  if (!managed.success) return managed
  const authorized = authorizationEnforce({
    actor: options.actor,
    minimumAssurance: options.minimumAssurance,
    organizationId: managed.data.organizationId,
    permission: options.permission,
    realmId: options.realmId,
    roles: managed.data.roles,
  })
  if (!authorized.success) return authorized
  return resultCreate(realmTenantContextCreate(options.actor, options.realmId))
}

type RealmAdministratorManagedAccess = {
  readonly organizationId: string
  readonly roles: readonly string[]
}

function realmAdministratorManagedAccessResolve(options: {
  readonly actorId: string
  readonly database: StorageDatabase
  readonly minimumAssurance?: SessionAssurance
  readonly permission: AuthorizationPermission
  readonly realmId: string
  readonly targetUserId: string
}): Result<RealmAdministratorManagedAccess> {
  const op = "realmAdministratorContextAuthorize"
  const forbidden = () =>
    resultErrorCodedCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")
  const administrator = realmAdministratorIs({
    database: options.database,
    realmId: options.realmId,
    userId: options.targetUserId,
  })
  if (!administrator.success) return administrator
  if (administrator.data) return forbidden()

  const actorMemberships = realmAdministratorActiveMembershipsRead(options.database, options.realmId, options.actorId)
  if (!actorMemberships.success) return actorMemberships
  const administered = new Map<string, readonly string[]>()
  for (const membership of actorMemberships.data) {
    if (membership.roles.includes("owner") || membership.roles.includes("admin"))
      administered.set(membership.organizationId, membership.roles)
  }
  if (administered.size === 0) return forbidden()

  const targetMemberships = realmAdministratorActiveMembershipsRead(
    options.database,
    options.realmId,
    options.targetUserId,
  )
  if (!targetMemberships.success) return targetMemberships
  if (targetMemberships.data.length === 0) return forbidden()

  if (options.permission === authorizationPermissionDefinitions.userRead) {
    const shared = targetMemberships.data.find((membership) => administered.has(membership.organizationId))
    if (shared === undefined) return forbidden()
    const actorRoles = administered.get(shared.organizationId)
    if (actorRoles === undefined) return forbidden()
    return resultCreate({ organizationId: shared.organizationId, roles: actorRoles })
  }

  const sharedOrganizationIds = targetMemberships.data
    .filter((membership) => administered.has(membership.organizationId))
    .map((membership) => membership.organizationId)
  const targetOrganizationIds = new Set(targetMemberships.data.map((membership) => membership.organizationId))
  const covered = sharedOrganizationIds.length > 0 && sharedOrganizationIds.length === targetOrganizationIds.size
  if (!covered) return forbidden()
  if (
    options.permission !== authorizationPermissionDefinitions.userManage &&
    options.permission !== authorizationPermissionDefinitions.userImpersonate
  )
    return forbidden()
  for (const membership of targetMemberships.data) {
    if (!membership.roles.includes("owner")) continue
    const actorRoles = administered.get(membership.organizationId)
    if (actorRoles === undefined || !actorRoles.includes("owner")) return forbidden()
  }
  const enforcedOrganizationId = sharedOrganizationIds[0]
  if (enforcedOrganizationId === undefined) return forbidden()
  const enforcedRoles = administered.get(enforcedOrganizationId)
  if (enforcedRoles === undefined) return forbidden()
  return resultCreate({ organizationId: enforcedOrganizationId, roles: enforcedRoles })
}

function realmAdministratorActiveMembershipsRead(
  database: StorageDatabase,
  realmId: string,
  userId: string,
): Result<{ organizationId: string; roles: string[] }[]> {
  const memberships: { organizationId: string; roles: string[] }[] = []
  let pageToken: string | undefined
  do {
    const page = organizationMembershipAccessList({ database, query: { pageSize: 100, pageToken }, realmId, userId })
    if (!page.success) return page
    memberships.push(...page.data.items.filter((item) => item.status === "active"))
    pageToken = page.data.nextPageToken
  } while (pageToken !== undefined)
  return resultCreate(memberships)
}

function assuranceRankGet(assurance: SessionAssurance): number {
  if (assurance === "multi_factor") return 2
  if (assurance === "authenticated") return 1
  return 0
}

function realmTenantContextCreate(actor: AuthorizationActorContext, realmId: string): RealmTenantContext {
  return { actor, actorId: actor.actorId, kind: "tenant", realmId }
}
