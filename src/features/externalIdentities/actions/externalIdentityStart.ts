import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import { instanceTenantContextCreate } from "../../instances/domain/instanceTenantContextCreate.js"
import { and, eq } from "drizzle-orm"
import { organizationTable } from "../../organizations/persistence/organizationTable.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityOpaqueSecretCreate } from "../domain/externalIdentityOpaqueSecretCreate.js"
import { externalIdentityPkceChallengeCreate } from "../domain/externalIdentityPkceChallengeCreate.js"
import { externalIdentityProviderDefaults } from "../domain/externalIdentityProviderDefaults.js"
import { externalIdentitySecretHashCreate } from "../domain/externalIdentitySecretHashCreate.js"
import type { ExternalIdentityProviderPorts } from "../domain/externalIdentityProviderPort.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityStartRequest } from "../public/externalIdentityStartRequestSchema.js"
import { externalIdentityStartRequestSchema } from "../public/externalIdentityStartRequestSchema.js"
import type { ExternalIdentityStartResponse } from "../public/externalIdentityStartResponseSchema.js"

const externalIdentityStateLifetimeMs = 10 * 60 * 1_000

type ExternalIdentityStartOptions = {
  readonly database: StorageDatabase
  readonly input: ExternalIdentityStartRequest
  readonly instanceId: string
  readonly providerId: string
  readonly providerPorts: ExternalIdentityProviderPorts
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function externalIdentityStart(options: ExternalIdentityStartOptions): Result<ExternalIdentityStartResponse> {
  const op = "externalIdentityStart"
  const parsed = v.safeParse(externalIdentityStartRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The external identity start request is invalid.")
  const context = instanceTenantContextCreate(options.instanceId, "anonymous")
  const instance = instanceGet({ context, database: options.database, instanceId: options.instanceId })
  if (!instance.success || instance.data.instance.status !== "active")
    return resultErrorCreate(op, "The external identity provider is unavailable.")
  const repository = externalIdentityRepositoryCreate(options.database.db)
  const provider = repository.externalIdentityProviderGet(options.instanceId, options.providerId)
  if (!provider.success) return provider
  if (
    provider.data === null ||
    !provider.data.enabled ||
    (parsed.output.organizationId === undefined && provider.data.organizationId !== null) ||
    (parsed.output.organizationId !== undefined && provider.data.organizationId !== parsed.output.organizationId)
  )
    return resultErrorCreate(op, "The external identity provider is unavailable.")
  if (parsed.output.organizationId !== undefined) {
    const organization = options.database.db
      .select({ id: organizationTable.id, instanceId: organizationTable.instanceId, status: organizationTable.status })
      .from(organizationTable)
      .where(
        and(
          eq(organizationTable.id, parsed.output.organizationId),
          eq(organizationTable.instanceId, options.instanceId),
        ),
      )
      .get()
    if (organization === undefined || organization.status !== "active")
      return resultErrorCreate(op, "The external identity provider is unavailable.")
  }
  const port = options.providerPorts[provider.data.type as keyof ExternalIdentityProviderPorts]
  if (port === undefined) return resultErrorCreate(op, "The external identity provider is unavailable.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The external identity timestamp is invalid.")
  const state = externalIdentityOpaqueSecretCreate(runtime)
  const nonce = externalIdentityProviderDefaults[provider.data.type as keyof typeof externalIdentityProviderDefaults]
    .usesNonce
    ? externalIdentityOpaqueSecretCreate(runtime)
    : undefined
  const pkceVerifier = externalIdentityOpaqueSecretCreate(runtime, 48)
  const stateHash = externalIdentitySecretHashCreate(state)
  const nonceHash = nonce === undefined ? null : externalIdentitySecretHashCreate(nonce)
  const pkceChallenge = externalIdentityPkceChallengeCreate(pkceVerifier)
  let scopes: string[]
  try {
    const parsedScopes = JSON.parse(provider.data.scopes) as unknown
    scopes = Array.isArray(parsedScopes) && parsedScopes.every((scope) => typeof scope === "string") ? parsedScopes : []
  } catch (_error) {
    scopes = []
  }
  const authorizationUrl = port.authorizationUrlCreate(
    {
      clientId: provider.data.clientId,
      clientSecret: provider.data.clientSecret,
      redirectUri: provider.data.redirectUri,
      scopes,
      type: provider.data.type as keyof ExternalIdentityProviderPorts,
    },
    { ...(nonce === undefined ? {} : { nonce }), pkceChallenge, state },
  )
  if (!authorizationUrl.success) return authorizationUrl
  const transactionId = uuidv7Create(runtime)
  const expiresAt = now + externalIdentityStateLifetimeMs
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) => {
    const currentRepository = externalIdentityRepositoryCreate(transaction)
    const created = currentRepository.externalIdentityOAuthTransactionCreate({
      callbackValidatedAt: null,
      confirmationTokenHash: null,
      consumedAt: null,
      createdAt: now,
      externalDisplayName: null,
      externalEmail: null,
      externalEmailVerified: null,
      externalIssuer: null,
      externalSubject: null,
      externalUsername: null,
      expiresAt,
      id: transactionId,
      instanceId: options.instanceId,
      intent: "sign_in",
      nonce,
      nonceHash,
      organizationId: provider.data?.organizationId ?? null,
      pkceVerifier,
      providerId: options.providerId,
      redirectUri: provider.data?.redirectUri ?? "",
      stateHash,
      userId: null,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: "authentication_started",
      providerId: options.providerId,
      providerType: provider.data?.type,
    })
    if (!payload.success) return resultErrorCreate(op, "The external identity event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: null,
        aggregateId: transactionId,
        aggregateType: "external_identity_oauth",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: externalIdentityEventTypes.authenticationStarted,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ authorizationUrl: authorizationUrl.data, expiresAt, providerId: options.providerId })
  })
  if (!committed.success) return committed
  return resultCreate(committed.data)
}
