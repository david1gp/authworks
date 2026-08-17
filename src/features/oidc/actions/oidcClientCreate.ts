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
import { instanceGet } from "../../instances/actions/instanceGet.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientSecretCreate } from "../domain/oidcClientSecretCreate.js"
import { oidcRedirectUriValidate } from "../domain/oidcRedirectUriValidate.js"
import { oidcSecretHashCreate } from "../domain/oidcSecretHashCreate.js"
import { oidcClientCreatedEventPayloadSchema } from "../events/oidcClientCreatedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { type OidcClientCreateRequest, oidcClientCreateRequestSchema } from "../public/oidcClientCreateRequestSchema.js"
import type { OidcClientCreateResponse } from "../public/oidcClientCreateResponseSchema.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"

type OidcClientCreateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: OidcClientCreateRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcClientCreate(options: OidcClientCreateOptions): Result<OidcClientCreateResponse> {
  const op = "oidcClientCreate"
  const parsed = v.safeParse(oidcClientCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The OIDC client request is invalid.")
  const authorized = oidcClientContextAuthorize({ context: options.context, instanceId: options.instanceId })
  if (!authorized.success) return authorized
  const instance = instanceGet({
    context: { actor: options.context.actor, actorId: options.context.actorId, kind: "system" },
    database: options.database,
    instanceId: options.instanceId,
  })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const configuration = oidcClientConfigurationValidate(parsed.output)
  if (!configuration.success) return configuration
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The client timestamp is invalid.")
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
    const created = repository.clientCreate({
      allowedScopes: JSON.stringify(configuration.data.allowedScopes),
      applicationId: parsed.output.applicationId ?? null,
      clientType: parsed.output.clientType,
      createdAt,
      id: clientId,
      instanceId: options.instanceId,
      name: parsed.output.name,
      postLogoutRedirectUris: JSON.stringify(configuration.data.postLogoutRedirectUris),
      projectId: parsed.output.projectId ?? null,
      redirectUris: JSON.stringify(configuration.data.redirectUris),
      requireConsent: configuration.data.requireConsent ? 1 : 0,
      secretHash,
      status: "active",
      trusted: configuration.data.trusted ? 1 : 0,
      updatedAt: createdAt,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(oidcClientCreatedEventPayloadSchema, {
      allowedScopes: configuration.data.allowedScopes,
      clientType: parsed.output.clientType,
      name: parsed.output.name,
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
        aggregateId: clientId,
        aggregateType: "oidc_client",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.clientCreated,
        instanceId: options.instanceId,
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
    return resultErrorCreate(op, "OIDC redirect URIs must be unique.")
  for (const uri of [...redirectUris, ...postLogoutRedirectUris]) {
    const valid = oidcRedirectUriValidate(uri)
    if (!valid.success) return valid
  }
  if (new Set(allowedScopes).size !== allowedScopes.length) return resultErrorCreate(op, "OIDC scopes must be unique.")
  return resultCreate({
    allowedScopes,
    postLogoutRedirectUris,
    redirectUris,
    requireConsent: input.requireConsent ?? true,
    trusted: input.trusted ?? false,
  })
}
