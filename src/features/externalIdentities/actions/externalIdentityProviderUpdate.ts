import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { externalIdentityProviderViewCreate } from "../domain/externalIdentityProviderViewCreate.js"
import { externalIdentityProviderScopesValidate } from "../domain/externalIdentityProviderScopesValidate.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityProvider } from "../public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderUpdateRequest } from "../public/externalIdentityProviderUpdateRequestSchema.js"
import { externalIdentityProviderUpdateRequestSchema } from "../public/externalIdentityProviderUpdateRequestSchema.js"

type ExternalIdentityProviderUpdateOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly input: ExternalIdentityProviderUpdateRequest
  readonly realmId: string
  readonly providerId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function externalIdentityProviderUpdate(
  options: ExternalIdentityProviderUpdateOptions,
): Result<{ provider: ExternalIdentityProvider }> {
  const op = "externalIdentityProviderUpdate"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can configure providers.", "external-identities.forbidden")
  const parsed = patchInputParse(
    op,
    externalIdentityProviderUpdateRequestSchema,
    options.input,
    "external-identities.empty-patch",
  )
  if (!parsed.success) return parsed
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The provider timestamp is invalid.", "external-identities.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = externalIdentityRepositoryCreate(transaction)
    const current = repository.externalIdentityProviderGet(options.realmId, options.providerId)
    if (!current.success) return current
    if (current.data === null)
      return resultErrorCreate(op, "The external identity provider was not found.", "external-identities.not-found")
    const scopes =
      parsed.data.scopes === undefined
        ? undefined
        : externalIdentityProviderScopesValidate(
            current.data.type as "github" | "google" | "microsoft",
            parsed.data.scopes,
          )
    if (scopes !== undefined && !scopes.success) return scopes
    const updated = repository.externalIdentityProviderUpdate(options.realmId, options.providerId, {
      ...(parsed.data.allowAccountCreation === undefined
        ? {}
        : { allowAccountCreation: parsed.data.allowAccountCreation }),
      ...(parsed.data.clientId === undefined ? {} : { clientId: parsed.data.clientId }),
      ...(parsed.data.clientSecret === undefined ? {} : { clientSecret: parsed.data.clientSecret }),
      ...(parsed.data.displayName === undefined ? {} : { displayName: parsed.data.displayName }),
      ...(parsed.data.enabled === undefined ? {} : { enabled: parsed.data.enabled }),
      ...(parsed.data.redirectUri === undefined ? {} : { redirectUri: parsed.data.redirectUri }),
      ...(scopes === undefined ? {} : { scopes: JSON.stringify(scopes.data) }),
      updatedAt: now,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCreate(op, "The external identity provider was not found.", "external-identities.not-found")
    const disabled = current.data.enabled && updated.data.enabled === false
    const eventVersion = repository.externalIdentityProviderEventVersionGet(options.providerId)
    if (!eventVersion.success) return eventVersion
    const payload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: disabled ? "provider_disabled" : "provider_updated",
      providerId: options.providerId,
      providerType: current.data.type,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The provider event payload is invalid.", "external-identities.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.providerId,
        aggregateType: "external_identity_provider",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: disabled ? externalIdentityEventTypes.providerDisabled : externalIdentityEventTypes.providerUpdated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ provider: externalIdentityProviderViewCreate(updated.data) })
  })
}
