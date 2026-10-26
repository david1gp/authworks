import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientCompatibilitySettingsValidate } from "../domain/oidcClientCompatibilitySettingsValidate.js"
import { oidcClientPolicyValidate } from "../domain/oidcClientPolicyValidate.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcClientSecretCreate } from "../domain/oidcClientSecretCreate.js"
import { oidcRedirectUriValidate } from "../domain/oidcRedirectUriValidate.js"
import { oidcSecretHashCreate } from "../domain/oidcSecretHashCreate.js"
import { oidcClientCreatedEventPayloadSchema } from "../events/oidcClientCreatedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { type OidcClientCreateRequest, oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import type { OidcClientCreateResponse } from "../public/oidcClientCreateResponseSchema.js"
import { oidcClientContextValidate } from "../server/oidcClientContextValidate.js"

type OidcClientCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OidcClientCreateRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcClientCreate(options: OidcClientCreateOptions): Result<OidcClientCreateResponse> {
  const op = "oidcClientCreate"
  const parsed = v.safeParse(oidcClientCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The OIDC client request is invalid.", "oidc.invalid")
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const realm = realmGet({
    context: { actor: options.context.actor, actorId: options.context.actorId, kind: "system" },
    database: options.database,
    realmId: options.realmId,
  })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCodedCreate(op, "The realm is not active.", "oidc.not-active")
  const configuration = oidcClientConfigurationValidate(parsed.output)
  if (!configuration.success) return configuration
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The client timestamp is invalid.", "oidc.invalid-timestamp")
  const clientId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  let clientSecret: string | undefined
  let secretHash: string | null = null
  if (parsed.output.clientType === "confidential") {
    const generated = oidcClientSecretCreate(runtime)
    if (!generated.success) return generated
    clientSecret = generated.data
    secretHash = oidcSecretHashCreate(clientSecret)
  }
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const clientContext = oidcClientContextValidate({
      applicationId: parsed.output.applicationId,
      executor: transaction,
      projectId: parsed.output.projectId,
      realmId: options.realmId,
    })
    if (!clientContext.success) return clientContext
    const created = repository.clientCreate({
      allowedScopes: JSON.stringify(configuration.data.allowedScopes),
      accessTokenLifetimeSeconds: configuration.data.policy.accessTokenLifetimeSeconds,
      accessTokenRoleAssertion: configuration.data.accessTokenRoleAssertion ? 1 : 0,
      applicationId: parsed.output.applicationId ?? null,
      clientType: parsed.output.clientType,
      createdAt,
      devMode: configuration.data.devMode ? 1 : 0,
      grantTypes: JSON.stringify(configuration.data.policy.grantTypes),
      id: clientId,
      idTokenLifetimeSeconds: configuration.data.policy.idTokenLifetimeSeconds,
      idTokenRoleAssertion: configuration.data.idTokenRoleAssertion ? 1 : 0,
      idTokenUserinfoAssertion: configuration.data.idTokenUserinfoAssertion ? 1 : 0,
      realmId: options.realmId,
      name: parsed.output.name,
      postLogoutRedirectUris: JSON.stringify(configuration.data.postLogoutRedirectUris),
      additionalOrigins: JSON.stringify(configuration.data.additionalOrigins),
      projectId: parsed.output.projectId ?? null,
      redirectUris: JSON.stringify(configuration.data.redirectUris),
      refreshTokenAbsoluteLifetimeSeconds: configuration.data.policy.refreshTokenAbsoluteLifetimeSeconds,
      refreshTokenIdleLifetimeSeconds: configuration.data.policy.refreshTokenIdleLifetimeSeconds,
      requireConsent: configuration.data.requireConsent ? 1 : 0,
      responseTypes: JSON.stringify(configuration.data.policy.responseTypes),
      secretHash,
      status: "active",
      trusted: configuration.data.trusted ? 1 : 0,
      updatedAt: createdAt,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(oidcClientCreatedEventPayloadSchema, {
      allowedScopes: configuration.data.allowedScopes,
      accessTokenLifetimeSeconds: configuration.data.policy.accessTokenLifetimeSeconds,
      accessTokenRoleAssertion: configuration.data.accessTokenRoleAssertion,
      clientType: parsed.output.clientType,
      additionalOrigins: configuration.data.additionalOrigins,
      devMode: configuration.data.devMode,
      grantTypes: configuration.data.policy.grantTypes,
      idTokenLifetimeSeconds: configuration.data.policy.idTokenLifetimeSeconds,
      idTokenRoleAssertion: configuration.data.idTokenRoleAssertion,
      idTokenUserinfoAssertion: configuration.data.idTokenUserinfoAssertion,
      name: parsed.output.name,
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
        aggregateId: clientId,
        aggregateType: "oidc_client",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.clientCreated,
        realmId: options.realmId,
        metadata: { source: "oidc" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const client = oidcClientPublicViewCreate(created.data)
    if (!client.success) return client
    return resultCreate({ client: client.data, ...(clientSecret === undefined ? {} : { clientSecret }) })
  })
}

function oidcClientConfigurationValidate(input: OidcClientCreateRequest): Result<{
  allowedScopes: string[]
  accessTokenRoleAssertion: boolean
  additionalOrigins: string[]
  devMode: boolean
  idTokenRoleAssertion: boolean
  idTokenUserinfoAssertion: boolean
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
  const op = "oidcClientConfigurationValidate"
  const redirectUris = input.redirectUris
  const postLogoutRedirectUris = input.postLogoutRedirectUris ?? []
  const allowedScopes = input.allowedScopes ?? ["openid"]
  if (
    new Set(redirectUris).size !== redirectUris.length ||
    new Set(postLogoutRedirectUris).size !== postLogoutRedirectUris.length
  )
    return resultErrorCodedCreate(op, "OIDC redirect URIs must be unique.", "oidc.conflict")
  const devMode = input.devMode ?? false
  for (const uri of [...redirectUris, ...postLogoutRedirectUris]) {
    const valid = oidcRedirectUriValidate(uri, true, devMode)
    if (!valid.success) return valid
  }
  if (new Set(allowedScopes).size !== allowedScopes.length)
    return resultErrorCodedCreate(op, "OIDC scopes must be unique.", "oidc.conflict")
  const compatibility = oidcClientCompatibilitySettingsValidate({
    accessTokenRoleAssertion: input.accessTokenRoleAssertion ?? false,
    additionalOrigins: input.additionalOrigins ?? [],
    idTokenRoleAssertion: input.idTokenRoleAssertion ?? false,
    idTokenUserinfoAssertion: input.idTokenUserinfoAssertion ?? false,
  })
  if (!compatibility.success) return compatibility
  const policy = oidcClientPolicyValidate({
    ...(input.accessTokenLifetimeSeconds === undefined
      ? {}
      : { accessTokenLifetimeSeconds: input.accessTokenLifetimeSeconds }),
    ...(input.grantTypes === undefined ? {} : { grantTypes: input.grantTypes }),
    ...(input.idTokenLifetimeSeconds === undefined ? {} : { idTokenLifetimeSeconds: input.idTokenLifetimeSeconds }),
    ...(input.refreshTokenAbsoluteLifetimeSeconds === undefined
      ? {}
      : { refreshTokenAbsoluteLifetimeSeconds: input.refreshTokenAbsoluteLifetimeSeconds }),
    ...(input.refreshTokenIdleLifetimeSeconds === undefined
      ? {}
      : { refreshTokenIdleLifetimeSeconds: input.refreshTokenIdleLifetimeSeconds }),
    ...(input.responseTypes === undefined ? {} : { responseTypes: input.responseTypes }),
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
    requireConsent: input.requireConsent ?? true,
    trusted: input.trusted ?? false,
  })
}
