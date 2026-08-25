import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { SessionRow } from "../../sessions/persistence/sessionTable.js"

type OidcResourceOwnerOrganizationIdResolveOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly session: Pick<SessionRow, "impersonationOrganizationId">
  readonly userId: string
}

export function oidcResourceOwnerOrganizationIdResolve(
  options: OidcResourceOwnerOrganizationIdResolveOptions,
): Result<string | undefined> {
  const repository = organizationRepositoryCreate(options.executor)
  const memberships = repository.organizationMembershipListByRealmUser(options.realmId, options.userId)
  if (!memberships.success) return memberships

  const organizationIds: string[] = []
  for (const membership of memberships.data) {
    if (membership.realmId !== options.realmId) continue
    const organization = repository.organizationGet(membership.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      continue
    organizationIds.push(organization.data.id)
  }

  if (options.session.impersonationOrganizationId !== null)
    return resultCreate(
      organizationIds.includes(options.session.impersonationOrganizationId)
        ? options.session.impersonationOrganizationId
        : undefined,
    )
  if (organizationIds.length !== 1) return resultCreate(undefined)
  return resultCreate(organizationIds[0])
}
