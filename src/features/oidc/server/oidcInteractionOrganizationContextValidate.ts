import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"

type OidcInteractionOrganizationContextValidateOptions = {
  readonly database: StorageDatabase
  readonly handle: string
  readonly organizationId?: string
  readonly realmId: string
}

export function oidcInteractionOrganizationContextValidate(
  options: OidcInteractionOrganizationContextValidateOptions,
): Result<void> {
  const op = "oidcInteractionOrganizationContextValidate"
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(options.handle))
    return resultErrorCodedCreate(op, "The OIDC interaction is invalid.", "oidc.invalid")
  const interaction = oidcRepositoryCreate(options.database.db).interactionGetByHandleHash(
    options.realmId,
    oidcHashCreate(options.handle),
  )
  if (!interaction.success) return interaction
  if (
    interaction.data === null ||
    interaction.data.completedAt !== null ||
    interaction.data.expiresAt <= options.database.runtime.now()
  )
    return resultErrorCodedCreate(op, "The OIDC interaction organization context is invalid.", "oidc.invalid")
  const context = organizationLoginContextValidate({
    context: {
      ...(interaction.data.organizationId === null ? {} : { organizationId: interaction.data.organizationId }),
      realmId: interaction.data.realmId,
    },
    executor: options.database.db,
    ...(options.organizationId === undefined ? {} : { expectedOrganizationId: options.organizationId }),
    expectedRealmId: options.realmId,
  })
  if (!context.success || context.data.organizationId !== (options.organizationId ?? undefined))
    return resultErrorCodedCreate(op, "The OIDC interaction organization context is invalid.", "oidc.invalid")
  return resultCreate(undefined)
}
