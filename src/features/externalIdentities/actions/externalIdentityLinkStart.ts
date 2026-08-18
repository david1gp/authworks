import * as v from "valibot"
import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationTable } from "../../organizations/persistence/organizationTable.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityOpaqueSecretCreate } from "../domain/externalIdentityOpaqueSecretCreate.js"
import { externalIdentityPkceChallengeCreate } from "../domain/externalIdentityPkceChallengeCreate.js"
import { externalIdentityProviderDefaults } from "../domain/externalIdentityProviderDefaults.js"
import type { ExternalIdentityProviderPorts } from "../domain/externalIdentityProviderPort.js"
import { externalIdentitySecretHashCreate } from "../domain/externalIdentitySecretHashCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityStartRequest } from "../public/externalIdentityStartRequestSchema.js"
import { externalIdentityStartRequestSchema } from "../public/externalIdentityStartRequestSchema.js"
import type { ExternalIdentityStartResponse } from "../public/externalIdentityStartResponseSchema.js"

const externalIdentityLinkLifetimeMs = 10 * 60 * 1_000
const externalIdentityRecentAuthenticationMs = 5 * 60 * 1_000

type ExternalIdentityLinkStartOptions = {
  readonly database: StorageDatabase
  readonly input: ExternalIdentityStartRequest
  readonly realmId: string
  readonly providerId: string
  readonly providerPorts: ExternalIdentityProviderPorts
  readonly session: Session
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function externalIdentityLinkStart(
  options: ExternalIdentityLinkStartOptions,
): Result<ExternalIdentityStartResponse> {
  const op = "externalIdentityLinkStart"
  const parsed = v.safeParse(externalIdentityStartRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The external identity link request is invalid.")
  if (options.session.realmId !== options.realmId || options.session.userId !== options.userId)
    return resultErrorCreate(op, "The session does not belong to this user.")
  if (options.session.assurance === "none")
    return resultErrorCreate(op, "A recent authentication is required before linking an external identity.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The external identity timestamp is invalid.")
  if (now - options.session.createdAt > externalIdentityRecentAuthenticationMs)
    return resultErrorCreate(op, "A recent authentication is required before linking an external identity.")
  const repository = externalIdentityRepositoryCreate(options.database.db)
  const provider = repository.externalIdentityProviderGet(options.realmId, options.providerId)
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
      .select({ id: organizationTable.id, realmId: organizationTable.realmId, status: organizationTable.status })
      .from(organizationTable)
      .where(
        and(eq(organizationTable.id, parsed.output.organizationId), eq(organizationTable.realmId, options.realmId)),
      )
      .get()
    if (organization === undefined || organization.status !== "active")
      return resultErrorCreate(op, "The external identity provider is unavailable.")
  }
  const port = options.providerPorts[provider.data.type as keyof ExternalIdentityProviderPorts]
  if (port === undefined) return resultErrorCreate(op, "The external identity provider is unavailable.")
  const state = externalIdentityOpaqueSecretCreate(runtime)
  const nonce = externalIdentityProviderDefaults[provider.data.type as keyof typeof externalIdentityProviderDefaults]
    .usesNonce
    ? externalIdentityOpaqueSecretCreate(runtime)
    : undefined
  const pkceVerifier = externalIdentityOpaqueSecretCreate(runtime, 48)
  const pkceChallenge = externalIdentityPkceChallengeCreate(pkceVerifier)
  const authorizationUrl = port.authorizationUrlCreate(
    {
      clientId: provider.data.clientId,
      clientSecret: provider.data.clientSecret,
      redirectUri: provider.data.redirectUri,
      scopes: externalIdentityScopesParse(provider.data.scopes),
      type: provider.data.type as keyof ExternalIdentityProviderPorts,
    },
    { ...(nonce === undefined ? {} : { nonce }), pkceChallenge, state },
  )
  if (!authorizationUrl.success) return authorizationUrl
  const transactionId = uuidv7Create(runtime)
  const expiresAt = now + externalIdentityLinkLifetimeMs
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
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
      realmId: options.realmId,
      intent: "link",
      nonce,
      nonceHash: nonce === undefined ? null : externalIdentitySecretHashCreate(nonce),
      organizationId: provider.data?.organizationId ?? null,
      pkceVerifier,
      providerId: options.providerId,
      redirectUri: provider.data?.redirectUri ?? "",
      stateHash: externalIdentitySecretHashCreate(state),
      userId: options.userId,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: "authentication_started",
      providerId: options.providerId,
      providerType: provider.data?.type,
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The external identity event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.userId,
        aggregateId: transactionId,
        aggregateType: "external_identity_oauth",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: externalIdentityEventTypes.authenticationStarted,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ authorizationUrl: authorizationUrl.data, expiresAt, providerId: options.providerId })
  })
}

function externalIdentityScopesParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed) && parsed.every((scope) => typeof scope === "string")) return parsed
  } catch (_error) {}
  return []
}
