import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcRedirectUriValidate } from "../domain/oidcRedirectUriValidate.js"
import { oidcClientUpdatedEventPayloadSchema } from "../events/oidcClientUpdatedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { type OidcClientUpdateRequest, oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import type { OidcClientResponse } from "../public/oidcClientResponseSchema.js"

type OidcClientUpdateOptions = {
  readonly clientId: string
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: OidcClientUpdateRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcClientUpdate(options: OidcClientUpdateOptions): Result<OidcClientResponse> {
  const op = "oidcClientUpdate"
  const parsed = v.safeParse(oidcClientUpdateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The OIDC client update is invalid.")
  if (Object.keys(parsed.output).length === 0) return resultErrorCreate(op, "The OIDC client update is empty.")
  const authorized = oidcClientContextAuthorize({ context: options.context, instanceId: options.instanceId })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The client timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const current = repository.clientGet(options.instanceId, options.clientId)
    if (!current.success) return current
    if (current.data === null || current.data.status === "removed")
      return resultErrorCreate(op, "The OIDC client was not found.")
    const configuration = oidcClientUpdateConfigurationValidate(parsed.output, current.data)
    if (!configuration.success) return configuration
    const updated = repository.clientUpdate(options.instanceId, options.clientId, {
      allowedScopes: JSON.stringify(configuration.data.allowedScopes),
      applicationId:
        parsed.output.applicationId === undefined ? current.data.applicationId : parsed.output.applicationId,
      name: parsed.output.name ?? current.data.name,
      postLogoutRedirectUris: JSON.stringify(configuration.data.postLogoutRedirectUris),
      projectId: parsed.output.projectId === undefined ? current.data.projectId : parsed.output.projectId,
      redirectUris: JSON.stringify(configuration.data.redirectUris),
      requireConsent: configuration.data.requireConsent ? 1 : 0,
      trusted: configuration.data.trusted ? 1 : 0,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The OIDC client was not found.")
    const payload = v.safeParse(oidcClientUpdatedEventPayloadSchema, {
      allowedScopes: configuration.data.allowedScopes,
      clientType: updated.data.clientType,
      name: updated.data.name,
      postLogoutRedirectUris: configuration.data.postLogoutRedirectUris,
      redirectUris: configuration.data.redirectUris,
      requireConsent: configuration.data.requireConsent,
      trusted: configuration.data.trusted,
    })
    if (!payload.success) return resultErrorCreate(op, "The OIDC client event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.clientId,
        aggregateType: "oidc_client",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.clientUpdated,
        instanceId: options.instanceId,
        metadata: { source: "oidc" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const client = oidcClientPublicViewCreate(updated.data)
    if (!client.success) return client
    return resultCreate({ client: client.data })
  })
}

function oidcClientUpdateConfigurationValidate(
  input: OidcClientUpdateRequest,
  current: {
    allowedScopes: string
    postLogoutRedirectUris: string
    redirectUris: string
    requireConsent: number
    trusted: number
  },
): Result<{
  allowedScopes: string[]
  postLogoutRedirectUris: string[]
  redirectUris: string[]
  requireConsent: boolean
  trusted: boolean
}> {
  const op = "oidcClientUpdateConfigurationValidate"
  let allowedScopes: string[]
  let postLogoutRedirectUris: string[]
  let redirectUris: string[]
  try {
    allowedScopes = input.allowedScopes ?? (JSON.parse(current.allowedScopes) as string[])
    postLogoutRedirectUris = input.postLogoutRedirectUris ?? (JSON.parse(current.postLogoutRedirectUris) as string[])
    redirectUris = input.redirectUris ?? (JSON.parse(current.redirectUris) as string[])
  } catch (_error) {
    return resultErrorCreate(op, "The OIDC client configuration is invalid.")
  }
  if (
    new Set(allowedScopes).size !== allowedScopes.length ||
    new Set(postLogoutRedirectUris).size !== postLogoutRedirectUris.length
  )
    return resultErrorCreate(op, "OIDC values must be unique.")
  if (new Set(redirectUris).size !== redirectUris.length)
    return resultErrorCreate(op, "OIDC redirect URIs must be unique.")
  for (const uri of [...redirectUris, ...postLogoutRedirectUris]) {
    const valid = oidcRedirectUriValidate(uri)
    if (!valid.success) return valid
  }
  return resultCreate({
    allowedScopes,
    postLogoutRedirectUris,
    redirectUris,
    requireConsent: input.requireConsent ?? current.requireConsent === 1,
    trusted: input.trusted ?? current.trusted === 1,
  })
}
