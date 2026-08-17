import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcClientResponse } from "../public/oidcClientResponseSchema.js"

type OidcClientGetOptions = {
  readonly clientId: string
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function oidcClientGet(options: OidcClientGetOptions): Result<OidcClientResponse> {
  const op = "oidcClientGet"
  const authorized = oidcClientContextAuthorize({ context: options.context, instanceId: options.instanceId })
  if (!authorized.success) return authorized
  const row = oidcRepositoryCreate(options.database.db).clientGet(options.instanceId, options.clientId)
  if (!row.success) return row
  if (row.data === null || row.data.status === "removed") return resultErrorCreate(op, "The OIDC client was not found.")
  const client = oidcClientPublicViewCreate(row.data)
  if (!client.success) return client
  return resultCreate({ client: client.data })
}
