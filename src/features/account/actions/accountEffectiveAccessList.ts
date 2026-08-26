import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationRoleKeysResolve } from "../../authorization/actions/authorizationRoleKeysResolve.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { organizationAccountAccessList } from "../../organizations/actions/organizationAccountAccessList.js"
import { projectAccountAccessList } from "../../projects/actions/projectAccountAccessList.js"
import type { AccountEffectiveAccessEntry } from "../public/accountEffectiveAccessEntrySchema.js"
import type { AccountEffectiveAccessListResponse } from "../public/accountEffectiveAccessListResponseSchema.js"

type AccountEffectiveAccessListOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
  readonly subjectId?: string
}

export function accountEffectiveAccessList(
  options: AccountEffectiveAccessListOptions,
): Result<AccountEffectiveAccessListResponse> {
  const op = "accountEffectiveAccessList"
  if (
    options.actor.kind !== "user" ||
    options.actor.realmId !== options.realmId ||
    options.actor.actorId.length === 0 ||
    options.realmId.length === 0 ||
    (options.subjectId !== undefined && (options.subjectId.length === 0 || options.subjectId !== options.actor.actorId))
  )
    return resultErrorCodedCreate(op, "The authenticated account is not available in this realm.", "account.forbidden")
  if (options.query?.sortBy !== undefined && options.query.sortBy !== "id")
    return resultErrorCodedCreate(op, "The effective-access sort is invalid.", "account.invalid")

  const organizations = organizationAccountAccessList({
    database: options.database,
    realmId: options.realmId,
    userId: options.subjectId ?? options.actor.actorId,
  })
  if (!organizations.success) return organizations
  const projects = projectAccountAccessList({
    database: options.database,
    organizationIds: organizations.data.items.map((item) => item.organization.id),
    realmId: options.realmId,
  })
  if (!projects.success) return projects

  const entries = new Map<string, AccountEffectiveAccessEntry>()
  const add = (entry: AccountEffectiveAccessEntry) => {
    const current = entries.get(entry.id)
    if (current === undefined) {
      entries.set(entry.id, entry)
      return
    }
    current.roleKeys = [...new Set([...current.roleKeys, ...entry.roleKeys])].sort().slice(0, 200)
    current.permissions = [
      ...new Set([...current.permissions, ...entry.permissions]),
    ].sort() as typeof current.permissions
  }
  const organizationById = new Map(organizations.data.items.map((item) => [item.organization.id, item] as const))
  for (const organization of organizations.data.items) {
    const resolved = authorizationRoleKeysResolve({ roles: organization.membership.roles })
    if (!resolved.success) return resolved
    add({
      id: `organization:${organization.organization.id}`,
      organization,
      permissions: resolved.data.permissions,
      roleKeys: resolved.data.roleKeys,
      source: "membership",
    })
  }
  for (const access of projects.data.items) {
    const organization = organizationById.get(access.organizationId)
    if (organization === undefined) continue
    const resolved = authorizationRoleKeysResolve({ roles: organization.membership.roles })
    if (!resolved.success) return resolved
    const permissions = [
      ...new Set([...resolved.data.permissions, ...access.permissions]),
    ].sort() as AccountEffectiveAccessEntry["permissions"]
    if (!permissions.includes(authorizationPermissionDefinitions.projectRead)) continue
    const roleKeys = [...new Set([...resolved.data.roleKeys, ...access.roleKeys])].sort().slice(0, 200)
    add({
      ...(access.grant === undefined ? {} : { grant: access.grant }),
      id:
        access.grant === undefined
          ? `project:${access.project.id}:organization:${access.organizationId}`
          : `project:${access.project.id}:grant:${access.organizationId}`,
      organization,
      permissions,
      project: access.project,
      roleKeys,
      source: access.grant === undefined ? "project-owner" : "project-grant",
    })
  }
  return listRowsPage({
    idGet: (entry) => entry.id,
    query: options.query,
    rows: [...entries.values()],
    sortValueGet: (entry) => entry.id,
  })
}
