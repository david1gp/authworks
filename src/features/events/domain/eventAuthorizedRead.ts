import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { realmAdministratorIs } from "../../realms/server/index.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { eventPublicViewCreate } from "./eventPublicViewCreate.js"
import { eventRepositoryCreate, type EventListFilters } from "../persistence/eventRepositoryCreate.js"
import type { Event } from "../public/eventSchema.js"

type EventAuthorizedReadOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly filters?: EventListFilters
}

export function eventAuthorizedRead(options: EventAuthorizedReadOptions): Result<Event[]> {
  const authorized = eventReadAccessCheck({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
  })
  if (!authorized.success) return authorized
  const events = eventRepositoryCreate(options.database.db).eventList(options.realmId, options.filters)
  if (!events.success) return events
  return {
    data: events.data.map(eventPublicViewCreate),
    success: true as const,
  }
}

function eventReadAccessCheck(options: {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}): Result<void> {
  const op = "eventAuthorizedRead"
  if (options.context.kind === "system")
    return authorizationEnforce({
      actor: options.context.actor,
      permission: authorizationPermissionDefinitions.eventRead,
      realmId: options.realmId,
    })
  if (options.context.actor.kind === "machine" || options.context.actor.kind === "bootstrap_admin")
    return authorizationEnforce({
      actor: options.context.actor,
      permission: authorizationPermissionDefinitions.eventRead,
      realmId: options.realmId,
    })
  if (options.context.actor.kind !== "user")
    return resultErrorCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")
  const administrator = realmAdministratorIs({
    database: options.database,
    realmId: options.realmId,
    userId: options.context.actorId,
  })
  if (!administrator.success) return administrator
  if (!administrator.data)
    return resultErrorCreate(op, "The actor is not authorized for this permission.", "authorization.forbidden")
  return authorizationEnforce({
    actor: options.context.actor,
    permission: authorizationPermissionDefinitions.eventRead,
    realmId: options.realmId,
    roles: ["realm_admin"],
  })
}
