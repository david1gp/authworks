import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationRow } from "../persistence/organizationTable.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationMetadataAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly organization: OrganizationRow
  readonly repository: ReturnType<typeof organizationRepositoryCreate>
  readonly requiredPermission: AuthorizationPermission
}

export function organizationMetadataAuthorize(options: OrganizationMetadataAuthorizeOptions): Result<void> {
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.actor.kind === "machine")
    return authorizationEnforce({
      actor: options.context.actor,
      organizationId: options.organization.id,
      permission: options.requiredPermission,
      realmId: options.organization.realmId,
    })
  return organizationContextAuthorize({
    context: options.context,
    database: options.database,
    organization: options.organization,
    repository: options.repository,
    requiredPermission: options.requiredPermission,
  })
}
