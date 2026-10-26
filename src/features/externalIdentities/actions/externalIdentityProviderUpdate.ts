import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { and, eq, isNull, ne } from "drizzle-orm"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { externalIdentityClientSecretProtect } from "../domain/externalIdentityClientSecretProtect.js"
import { externalIdentityOidcIssuerValidate } from "../domain/externalIdentityOidcIssuerValidate.js"
import { externalIdentityProviderScopesValidate } from "../domain/externalIdentityProviderScopesValidate.js"
import { externalIdentityProviderTable } from "../persistence/externalIdentityProviderTable.js"
import { externalIdentityProviderViewCreate } from "../domain/externalIdentityProviderViewCreate.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityProvider } from "../public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderUpdateRequest } from "../public/externalIdentityProviderUpdateRequestSchema.js"
import { externalIdentityProviderUpdateRequestSchema } from "../public/externalIdentityProviderUpdateRequestSchema.js"

type ExternalIdentityProviderUpdateOptions = {
  readonly allowDevelopmentFallback?: boolean
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
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
            current.data.type as "github" | "google" | "microsoft" | "oidc",
            parsed.data.scopes,
          )
    if (scopes !== undefined && !scopes.success) return scopes
    const issuer =
      parsed.data.issuer === undefined
        ? undefined
        : externalIdentityProviderIssuerResolve(current.data.type, parsed.data.issuer)
    if (issuer !== undefined && !issuer.success) return issuer
    if (issuer !== undefined && issuer.success && issuer.data !== null) {
      const conflict = transaction
        .select({ id: externalIdentityProviderTable.id })
        .from(externalIdentityProviderTable)
        .where(
          and(
            eq(externalIdentityProviderTable.realmId, options.realmId),
            eq(externalIdentityProviderTable.type, current.data.type),
            current.data.organizationId === null
              ? isNull(externalIdentityProviderTable.organizationId)
              : eq(externalIdentityProviderTable.organizationId, current.data.organizationId),
            eq(externalIdentityProviderTable.issuer, issuer.data),
            ne(externalIdentityProviderTable.id, options.providerId),
          ),
        )
        .get()
      if (conflict !== undefined)
        return resultErrorCreate(
          op,
          "An external identity provider with that scope already exists.",
          "external-identities.already-exists",
        )
    }
    const clientSecret =
      parsed.data.clientSecret === undefined
        ? externalIdentityProviderStoredSecretMigrate(
            current.data.clientSecret,
            options.realmId,
            options.encryptionSecret,
            options.allowDevelopmentFallback === true,
          )
        : externalIdentityClientSecretProtect(
            "encrypt",
            parsed.data.clientSecret,
            options.realmId,
            options.encryptionSecret,
            options.allowDevelopmentFallback === true,
          )
    if (!clientSecret.success) return clientSecret
    const updated = repository.externalIdentityProviderUpdate(options.realmId, options.providerId, {
      ...(parsed.data.allowAccountCreation === undefined
        ? {}
        : { allowAccountCreation: parsed.data.allowAccountCreation }),
      ...(parsed.data.clientId === undefined ? {} : { clientId: parsed.data.clientId }),
      ...(clientSecret.data === null ? {} : { clientSecret: clientSecret.data }),
      ...(parsed.data.displayName === undefined ? {} : { displayName: parsed.data.displayName }),
      ...(parsed.data.enabled === undefined ? {} : { enabled: parsed.data.enabled }),
      ...(parsed.data.redirectUri === undefined ? {} : { redirectUri: parsed.data.redirectUri }),
      ...(issuer === undefined || !issuer.success || issuer.data === null ? {} : { issuer: issuer.data }),
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

function externalIdentityProviderIssuerResolve(providerType: string, issuer: string): Result<string | null> {
  const op = "externalIdentityProviderUpdate"
  if (providerType !== "oidc")
    return resultErrorCreate(op, "Only generic OIDC providers accept an issuer.", "external-identities.invalid")
  const validated = externalIdentityOidcIssuerValidate(issuer)
  if (!validated.success) return validated
  return resultCreate(validated.data)
}

function externalIdentityProviderStoredSecretMigrate(
  storedSecret: string,
  realmId: string,
  encryptionSecret: Secret | string | undefined,
  allowDevelopmentFallback: boolean,
): Result<string | null> {
  // Rows written before secret encryption keep working untouched when no key is
  // configured; encrypt-on-next-update only rewrites when it can do so safely.
  if (storedSecret.startsWith("v1.")) return resultCreate(null)
  const protectedSecret = externalIdentityClientSecretProtect(
    "encrypt",
    storedSecret,
    realmId,
    encryptionSecret,
    allowDevelopmentFallback,
  )
  if (!protectedSecret.success) return resultCreate(null)
  return resultCreate(protectedSecret.data)
}
