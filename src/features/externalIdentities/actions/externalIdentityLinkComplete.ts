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
import type { Session } from "../../sessions/public/sessionSchema.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentitySecretHashCreate } from "../domain/externalIdentitySecretHashCreate.js"
import { externalIdentityViewCreate } from "../domain/externalIdentityViewCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import { externalIdentityProviderTable } from "../persistence/externalIdentityProviderTable.js"
import type { ExternalIdentityLinkCompleteRequest } from "../public/externalIdentityLinkCompleteRequestSchema.js"
import { externalIdentityLinkCompleteRequestSchema } from "../public/externalIdentityLinkCompleteRequestSchema.js"
import type { ExternalIdentityLinkCompleteResponse } from "../public/externalIdentityLinkCompleteResponseSchema.js"

const externalIdentityRecentAuthenticationMs = 5 * 60 * 1_000

type ExternalIdentityLinkCompleteOptions = {
  readonly database: StorageDatabase
  readonly input: ExternalIdentityLinkCompleteRequest
  readonly instanceId: string
  readonly providerId: string
  readonly session: Session
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function externalIdentityLinkComplete(
  options: ExternalIdentityLinkCompleteOptions,
): Result<ExternalIdentityLinkCompleteResponse> {
  const op = "externalIdentityLinkComplete"
  const parsed = v.safeParse(externalIdentityLinkCompleteRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "Explicit link confirmation is required.")
  if (options.session.instanceId !== options.instanceId || options.session.userId !== options.userId)
    return resultErrorCreate(op, "The session does not belong to this user.")
  if (options.session.assurance === "none")
    return resultErrorCreate(op, "A recent authentication is required before linking an external identity.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0 || now - options.session.createdAt > externalIdentityRecentAuthenticationMs)
    return resultErrorCreate(op, "A recent authentication is required before linking an external identity.")
  const repository = externalIdentityRepositoryCreate(options.database.db)
  const pending = repository.externalIdentityOAuthTransactionGetByConfirmationToken(
    options.instanceId,
    externalIdentitySecretHashCreate(parsed.output.confirmationToken),
  )
  if (!pending.success) return pending
  if (
    pending.data === null ||
    pending.data.intent !== "link" ||
    pending.data.providerId !== options.providerId ||
    pending.data.userId !== options.userId ||
    pending.data.callbackValidatedAt === null ||
    pending.data.consumedAt !== null ||
    pending.data.expiresAt <= now ||
    pending.data.externalSubject === null
  )
    return resultErrorCreate(op, "The external identity link confirmation is invalid.")
  const pendingRow = pending.data
  if (pendingRow.externalSubject === null)
    return resultErrorCreate(op, "The external identity link confirmation is invalid.")
  const externalSubject = pendingRow.externalSubject
  const provider = repository.externalIdentityProviderGet(options.instanceId, pending.data.providerId)
  if (!provider.success) return provider
  if (provider.data === null || !provider.data.enabled || provider.data.redirectUri !== pending.data.redirectUri)
    return resultErrorCreate(op, "The external identity link confirmation is invalid.")
  const providerRow = provider.data
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const currentRepository = externalIdentityRepositoryCreate(transaction)
    const current = currentRepository.externalIdentityOAuthTransactionGetByConfirmationToken(
      options.instanceId,
      externalIdentitySecretHashCreate(parsed.output.confirmationToken),
    )
    if (!current.success) return current
    if (current.data === null || current.data.version !== pendingRow.version)
      return resultErrorCreate(op, "The external identity link confirmation is invalid.")
    const duplicate = currentRepository.externalIdentityGetByProviderSubject(pendingRow.providerId, externalSubject)
    if (!duplicate.success) return duplicate
    if (duplicate.data !== null) {
      if (duplicate.data.userId === options.userId)
        return resultErrorCreate(op, "The external identity is already linked.")
      return resultErrorCreate(op, "The external identity is already linked to another account.")
    }
    const identity = currentRepository.externalIdentityCreate({
      createdAt: now,
      displayName: pendingRow.externalDisplayName,
      email: pendingRow.externalEmail,
      emailVerified: pendingRow.externalEmailVerified === true,
      externalSubject,
      id: uuidv7Create(runtime),
      instanceId: options.instanceId,
      providerId: pendingRow.providerId,
      updatedAt: now,
      userId: options.userId,
      username: pendingRow.externalUsername,
      version: 1,
    })
    if (!identity.success) return resultErrorCreate(op, "The external identity is already linked to another account.")
    const consumed = currentRepository.externalIdentityOAuthTransactionConsume(pendingRow.id, pendingRow.version, now)
    if (!consumed.success) return consumed
    if (consumed.data === null) return resultErrorCreate(op, "The external identity link confirmation is invalid.")
    const payload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: "linked",
      externalSubject: identity.data.externalSubject,
      identityId: identity.data.id,
      providerId: pendingRow.providerId,
      providerType: providerRow.type,
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The external identity event payload is invalid.")
    const identityEvent = storageEventAppend(
      transaction,
      {
        actorId: options.userId,
        aggregateId: identity.data.id,
        aggregateType: "external_identity",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: externalIdentityEventTypes.linked,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!identityEvent.success) return identityEvent
    return resultCreate({ externalIdentity: externalIdentityViewCreate(identity.data, providerRow.type), linked: true })
  })
}
