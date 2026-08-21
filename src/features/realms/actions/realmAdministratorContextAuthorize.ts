import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import { organizationMembershipAccessList } from "../../organizations/actions/organizationMembershipAccessList.js"
import type { SessionAssurance } from "../../sessions/public/sessionAssuranceSchema.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"

type RealmAdministratorContextAuthorizeOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly minimumAssurance?: SessionAssurance
  readonly permission: AuthorizationPermission
  readonly realmId: string
}

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

  let pageToken: string | undefined
  do {
    const memberships = organizationMembershipAccessList({
      database: options.database,
      query: { pageSize: 100, pageToken },
      realmId: options.realmId,
      userId: options.actor.actorId,
    })
    if (!memberships.success) return memberships
    for (const membership of memberships.data.items) {
      if (
        membership.status !== "active" ||
        (!membership.roles.includes("owner") && !membership.roles.includes("admin"))
      )
        continue
      const authorized = authorizationEnforce({
        actor: options.actor,
        minimumAssurance: options.minimumAssurance,
        permission: options.permission,
        realmId: options.realmId,
        roles: ["realm_admin"],
      })
      if (authorized.success) return resultCreate(realmTenantContextCreate(options.actor, options.realmId))
      if (authorized.code === "authorization.insufficient-assurance") return authorized
    }
    pageToken = memberships.data.nextPageToken
  } while (pageToken !== undefined)

  return resultErrorCodedCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")
}

function assuranceRankGet(assurance: SessionAssurance): number {
  if (assurance === "multi_factor") return 2
  if (assurance === "authenticated") return 1
  return 0
}

function realmTenantContextCreate(actor: AuthorizationActorContext, realmId: string): RealmTenantContext {
  return { actor, actorId: actor.actorId, kind: "tenant", realmId }
}
