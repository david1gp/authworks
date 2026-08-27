import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretMatches } from "../../../platform/secrets/secretMatches.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionReturnPathValidate } from "../../sessions/domain/sessionReturnPathValidate.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcValueDecrypt } from "../domain/oidcValueEncrypt.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import type { OidcInteractionRow } from "../persistence/oidcInteractionTable.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import type { OidcAuthorizationRequest } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcAuthorizationRequestSchema } from "../public/oidcAuthorizationRequestSchema.js"
import { oidcClientContextValidate } from "../server/oidcClientContextValidate.js"

type OidcAuthorizationInteractionResolveOptions = {
  readonly binding?: string
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly handle: string
  readonly publicOrigin: string
  readonly realmId: string
}

export function oidcAuthorizationInteractionResolve(options: OidcAuthorizationInteractionResolveOptions): Result<{
  readonly interaction: OidcInteractionRow
  readonly input: OidcAuthorizationRequest
}> {
  const op = "oidcAuthorizationInteractionResolve"
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(options.handle)) return resultErrorCreate(op, "The OIDC interaction is invalid.")
  const row = oidcRepositoryCreate(options.database.db).interactionGetByHandleHash(
    options.realmId,
    oidcHashCreate(options.handle),
  )
  if (!row.success) return row
  if (
    row.data === null ||
    row.data.completedAt !== null ||
    row.data.expiresAt <= options.database.runtime.now() ||
    (options.binding !== undefined && !secretMatches(oidcHashCreate(options.binding), row.data.bindingHash)) ||
    options.binding === undefined
  )
    return resultErrorCreate(op, "The OIDC interaction is invalid.")
  const loginContext = organizationLoginContextValidate({
    context: {
      ...(row.data.organizationId === null ? {} : { organizationId: row.data.organizationId }),
      realmId: row.data.realmId,
    },
    executor: options.database.db,
    expectedRealmId: options.realmId,
  })
  if (!loginContext.success) return resultErrorCreate(op, "The OIDC interaction is invalid.")
  const expectedResumePath = `/oauth2/authorize?interaction=${encodeURIComponent(options.handle)}`
  const resumePath = sessionReturnPathValidate(row.data.resumePath, options.publicOrigin)
  if (!resumePath.success || resumePath.data !== row.data.resumePath || row.data.resumePath !== expectedResumePath)
    return resultErrorCreate(op, "The OIDC interaction is invalid.")
  const decrypted = oidcValueDecrypt(row.data.requestEncrypted, options.realmId, options.encryptionSecret)
  if (!decrypted.success) return resultErrorCreate(op, "The OIDC interaction is invalid.")
  try {
    const input = v.safeParse(oidcAuthorizationRequestSchema, JSON.parse(decrypted.data))
    if (!input.success) return resultErrorCreate(op, "The OIDC interaction is invalid.")
    const client = oidcRepositoryCreate(options.database.db).clientGet(options.realmId, input.output.client_id)
    if (!client.success) return client
    if (client.data === null || client.data.status !== "active")
      return resultErrorCreate(op, "The OIDC interaction is invalid.")
    const clientContext = oidcClientContextValidate({
      applicationId: client.data.applicationId,
      executor: options.database.db,
      ...(row.data.organizationId === null ? {} : { organizationId: row.data.organizationId }),
      projectId: client.data.projectId,
      realmId: options.realmId,
    })
    if (!clientContext.success) return resultErrorCreate(op, "The OIDC interaction is invalid.")
    return resultCreate({ input: input.output, interaction: row.data })
  } catch (_error) {
    return resultErrorCreate(op, "The OIDC interaction is invalid.")
  }
}
