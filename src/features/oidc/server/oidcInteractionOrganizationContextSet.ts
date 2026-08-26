import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { organizationLoginContextResolve } from "../../organizations/server/organizationLoginContextResolve.js"

type OidcInteractionOrganizationContextSetOptions = {
  readonly database: StorageDatabase
  readonly handle: string
  readonly organizationId: string
  readonly realmId: string
}

export function oidcInteractionOrganizationContextSet(
  options: OidcInteractionOrganizationContextSetOptions,
): Result<void> {
  const op = "oidcInteractionOrganizationContextSet"
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(options.handle))
    return resultErrorCodedCreate(op, "The OIDC interaction is invalid.", "oidc.invalid")
  return storageTransactionRun(options.database, (transaction) => {
    const interaction = oidcRepositoryCreate(transaction).interactionGetByHandleHash(
      options.realmId,
      oidcHashCreate(options.handle),
    )
    if (!interaction.success) return interaction
    if (
      interaction.data === null ||
      interaction.data.completedAt !== null ||
      interaction.data.expiresAt <= options.database.runtime.now()
    )
      return resultErrorCodedCreate(op, "The OIDC interaction is invalid.", "oidc.invalid")
    const context = organizationLoginContextResolve({
      executor: transaction,
      organizationId: options.organizationId,
      realmId: options.realmId,
    })
    if (!context.success || context.data.organizationId === undefined)
      return resultErrorCodedCreate(op, "The OIDC interaction organization context is unavailable.", "oidc.invalid")
    const updated = oidcRepositoryCreate(transaction).interactionOrganizationContextSet(
      options.realmId,
      interaction.data.id,
      context.data.organizationId,
    )
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCodedCreate(op, "The OIDC interaction organization context is stale.", "oidc.invalid")
    return resultCreate(undefined)
  })
}
