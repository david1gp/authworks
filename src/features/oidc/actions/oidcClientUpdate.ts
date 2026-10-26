import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientCompatibilitySettingsValidate } from "../domain/oidcClientCompatibilitySettingsValidate.js"
import { oidcClientPolicyValidate } from "../domain/oidcClientPolicyValidate.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcRedirectUriValidate } from "../domain/oidcRedirectUriValidate.js"
import { oidcClientUpdatedEventPayloadSchema } from "../events/oidcClientUpdatedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcClientResponse } from "../public/oidcClientResponseSchema.js"
import { type OidcClientUpdateRequest, oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import { oidcClientContextValidate } from "../server/oidcClientContextValidate.js"

type OidcClientUpdateOptions = {
  readonly clientId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OidcClientUpdateRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcClientUpdate(options: OidcClientUpdateOptions): Result<OidcClientResponse> {
  const op = "oidcClientUpdate"
  const parsed = patchInputParse(op, oidcClientUpdateRequestSchema, options.input, "oidc.empty-patch")
  if (!parsed.success) return parsed
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCodedCreate(op, "The client timestamp is invalid.", "oidc.timestamp-invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const current = repository.clientGet(options.realmId, options.clientId)
    if (!current.success) return current
    if (current.data === null || current.data.status === "removed")
      return resultErrorCodedCreate(op, "The OIDC client was not found.", "oidc.not-found")
    const configuration = oidcClientUpdateConfigurationValidate(parsed.data, current.data)
    if (!configuration.success) return configuration
    const clientContext = oidcClientContextValidate({
      applicationId: parsed.data.applicationId === undefined ? current.data.applicationId : parsed.data.applicationId,
      executor: transaction,
      projectId: parsed.data.projectId === undefined ? current.data.projectId : parsed.data.projectId,
      realmId: options.realmId,
    })
    if (!clientContext.success) return clientContext
    const updated = repository.clientUpdate(options.realmId, options.clientId, {
      allowedScopes: JSON.stringify(configuration.data.allowedScopes),
      accessTokenLifetimeSeconds: configuration.data.policy.accessTokenLifetimeSeconds,
      accessTokenRoleAssertion: configuration.data.accessTokenRoleAssertion ? 1 : 0,
      applicationId: parsed.data.applicationId === undefined ? current.data.applicationId : parsed.data.applicationId,
      additionalOrigins: JSON.stringify(configuration.data.additionalOrigins),
      devMode: configuration.data.devMode ? 1 : 0,
      grantTypes: JSON.stringify(configuration.data.policy.grantTypes),
      idTokenLifetimeSeconds: configuration.data.policy.idTokenLifetimeSeconds,
      idTokenRoleAssertion: configuration.data.idTokenRoleAssertion ? 1 : 0,
      idTokenUserinfoAssertion: configuration.data.idTokenUserinfoAssertion ? 1 : 0,
      name: parsed.data.name ?? current.data.name,
      postLogoutRedirectUris: JSON.stringify(configuration.data.postLogoutRedirectUris),
      projectId: parsed.data.projectId === undefined ? current.data.projectId : parsed.data.projectId,
      redirectUris: JSON.stringify(configuration.data.redirectUris),
      refreshTokenAbsoluteLifetimeSeconds: configuration.data.policy.refreshTokenAbsoluteLifetimeSeconds,
      refreshTokenIdleLifetimeSeconds: configuration.data.policy.refreshTokenIdleLifetimeSeconds,
      requireConsent: configuration.data.requireConsent ? 1 : 0,
      responseTypes: JSON.stringify(configuration.data.policy.responseTypes),
      trusted: configuration.data.trusted ? 1 : 0,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCodedCreate(op, "The OIDC client was not found.", "oidc.not-found")
    const payload = v.safeParse(oidcClientUpdatedEventPayloadSchema, {
      allowedScopes: configuration.data.allowedScopes,
      accessTokenLifetimeSeconds: configuration.data.policy.accessTokenLifetimeSeconds,
      accessTokenRoleAssertion: configuration.data.accessTokenRoleAssertion,
      clientType: updated.data.clientType,
      additionalOrigins: configuration.data.additionalOrigins,
      devMode: configuration.data.devMode,
      grantTypes: configuration.data.policy.grantTypes,
      idTokenLifetimeSeconds: configuration.data.policy.idTokenLifetimeSeconds,
      idTokenRoleAssertion: configuration.data.idTokenRoleAssertion,
      idTokenUserinfoAssertion: configuration.data.idTokenUserinfoAssertion,
      name: updated.data.name,
      postLogoutRedirectUris: configuration.data.postLogoutRedirectUris,
      redirectUris: configuration.data.redirectUris,
      refreshTokenAbsoluteLifetimeSeconds: configuration.data.policy.refreshTokenAbsoluteLifetimeSeconds,
      refreshTokenIdleLifetimeSeconds: configuration.data.policy.refreshTokenIdleLifetimeSeconds,
      requireConsent: configuration.data.requireConsent,
      responseTypes: configuration.data.policy.responseTypes,
      trusted: configuration.data.trusted,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The OIDC client event payload is invalid.", "oidc.event-invalid")
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
        realmId: options.realmId,
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
    accessTokenLifetimeSeconds: number | null
    accessTokenRoleAssertion: number
    additionalOrigins: string
    devMode: number
    grantTypes: string
    idTokenLifetimeSeconds: number | null
    idTokenRoleAssertion: number
    idTokenUserinfoAssertion: number
    allowedScopes: string
    postLogoutRedirectUris: string
    redirectUris: string
    refreshTokenAbsoluteLifetimeSeconds: number | null
    refreshTokenIdleLifetimeSeconds: number | null
    requireConsent: number
    responseTypes: string
    trusted: number
  },
): Result<{
  accessTokenRoleAssertion: boolean
  additionalOrigins: string[]
  devMode: boolean
  idTokenRoleAssertion: boolean
  idTokenUserinfoAssertion: boolean
  allowedScopes: string[]
  policy: {
    accessTokenLifetimeSeconds: number | null
    grantTypes: string[]
    idTokenLifetimeSeconds: number | null
    refreshTokenAbsoluteLifetimeSeconds: number | null
    refreshTokenIdleLifetimeSeconds: number | null
    responseTypes: string[]
  }
  postLogoutRedirectUris: string[]
  redirectUris: string[]
  requireConsent: boolean
  trusted: boolean
}> {
  const op = "oidcClientUpdateConfigurationValidate"
  let allowedScopes: string[]
  let postLogoutRedirectUris: string[]
  let redirectUris: string[]
  let additionalOrigins: unknown
  let storedGrantTypes: unknown
  let storedResponseTypes: unknown
  try {
    allowedScopes = input.allowedScopes ?? (JSON.parse(current.allowedScopes) as string[])
    postLogoutRedirectUris = input.postLogoutRedirectUris ?? (JSON.parse(current.postLogoutRedirectUris) as string[])
    redirectUris = input.redirectUris ?? (JSON.parse(current.redirectUris) as string[])
    additionalOrigins = JSON.parse(current.additionalOrigins ?? "[]")
    storedGrantTypes = JSON.parse(current.grantTypes)
    storedResponseTypes = JSON.parse(current.responseTypes)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The OIDC client configuration is invalid.", "oidc.configuration-invalid")
  }
  if (
    new Set(allowedScopes).size !== allowedScopes.length ||
    new Set(postLogoutRedirectUris).size !== postLogoutRedirectUris.length
  )
    return resultErrorCodedCreate(op, "OIDC values must be unique.", "oidc.conflict")
  if (new Set(redirectUris).size !== redirectUris.length)
    return resultErrorCodedCreate(op, "OIDC redirect URIs must be unique.", "oidc.conflict")
  if (
    !Array.isArray(additionalOrigins) ||
    !additionalOrigins.every((origin): origin is string => typeof origin === "string") ||
    !Array.isArray(storedGrantTypes) ||
    !storedGrantTypes.every((grant): grant is string => typeof grant === "string") ||
    !Array.isArray(storedResponseTypes) ||
    !storedResponseTypes.every((response): response is string => typeof response === "string")
  )
    return resultErrorCodedCreate(op, "The OIDC client configuration is invalid.", "oidc.configuration-invalid")
  const devMode = input.devMode ?? current.devMode === 1
  for (const uri of [...redirectUris, ...postLogoutRedirectUris]) {
    const valid = oidcRedirectUriValidate(uri, true, devMode)
    if (!valid.success) return valid
  }
  const compatibility = oidcClientCompatibilitySettingsValidate({
    accessTokenRoleAssertion: input.accessTokenRoleAssertion ?? current.accessTokenRoleAssertion === 1,
    additionalOrigins: input.additionalOrigins ?? additionalOrigins,
    idTokenRoleAssertion: input.idTokenRoleAssertion ?? current.idTokenRoleAssertion === 1,
    idTokenUserinfoAssertion: input.idTokenUserinfoAssertion ?? current.idTokenUserinfoAssertion === 1,
  })
  if (!compatibility.success) return compatibility
  const policy = oidcClientPolicyValidate({
    accessTokenLifetimeSeconds:
      input.accessTokenLifetimeSeconds === undefined
        ? current.accessTokenLifetimeSeconds
        : input.accessTokenLifetimeSeconds,
    grantTypes: input.grantTypes ?? storedGrantTypes,
    idTokenLifetimeSeconds:
      input.idTokenLifetimeSeconds === undefined ? current.idTokenLifetimeSeconds : input.idTokenLifetimeSeconds,
    refreshTokenAbsoluteLifetimeSeconds:
      input.refreshTokenAbsoluteLifetimeSeconds === undefined
        ? current.refreshTokenAbsoluteLifetimeSeconds
        : input.refreshTokenAbsoluteLifetimeSeconds,
    refreshTokenIdleLifetimeSeconds:
      input.refreshTokenIdleLifetimeSeconds === undefined
        ? current.refreshTokenIdleLifetimeSeconds
        : input.refreshTokenIdleLifetimeSeconds,
    responseTypes: input.responseTypes ?? storedResponseTypes,
  })
  if (!policy.success) return policy
  return resultCreate({
    allowedScopes,
    accessTokenRoleAssertion: compatibility.data.accessTokenRoleAssertion,
    additionalOrigins: compatibility.data.additionalOrigins,
    devMode,
    idTokenRoleAssertion: compatibility.data.idTokenRoleAssertion,
    idTokenUserinfoAssertion: compatibility.data.idTokenUserinfoAssertion,
    policy: policy.data,
    postLogoutRedirectUris,
    redirectUris,
    requireConsent: input.requireConsent ?? current.requireConsent === 1,
    trusted: input.trusted ?? current.trusted === 1,
  })
}
