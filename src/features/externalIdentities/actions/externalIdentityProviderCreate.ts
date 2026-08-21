import { and, eq, isNull } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationTable } from "../../organizations/persistence/organizationTable.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { externalIdentityProviderDefaults } from "../domain/externalIdentityProviderDefaults.js"
import { externalIdentityProviderViewCreate } from "../domain/externalIdentityProviderViewCreate.js"
import { externalIdentityEventPayloadSchema } from "../events/externalIdentityEventPayloadSchema.js"
import { externalIdentityEventTypes } from "../events/externalIdentityEventTypes.js"
import { externalIdentityProviderTable } from "../persistence/externalIdentityProviderTable.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityProviderCreateRequest } from "../public/externalIdentityProviderCreateRequestSchema.js"
import { externalIdentityProviderCreateRequestSchema } from "../public/externalIdentityProviderCreateRequestSchema.js"
import type { ExternalIdentityProvider } from "../public/externalIdentityProviderSchema.js"

type ExternalIdentityProviderCreateOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly input: ExternalIdentityProviderCreateRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function externalIdentityProviderCreate(
  options: ExternalIdentityProviderCreateOptions,
): Result<{ provider: ExternalIdentityProvider }> {
  const op = "externalIdentityProviderCreate"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can configure providers.", "external-identities.forbidden")
  const parsed = v.safeParse(externalIdentityProviderCreateRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCreate(op, "The external identity provider request is invalid.", "external-identities.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The realm is not active.", "external-identities.not-active")
  if (parsed.output.organizationId !== undefined) {
    const organization = options.database.db
      .select({ id: organizationTable.id, realmId: organizationTable.realmId, status: organizationTable.status })
      .from(organizationTable)
      .where(eq(organizationTable.id, parsed.output.organizationId))
      .get()
    if (organization === undefined || organization.realmId !== options.realmId || organization.status !== "active")
      return resultErrorCreate(op, "The organization was not found.", "external-identities.not-found")
  }
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The provider timestamp is invalid.", "external-identities.invalid-timestamp")
  const providerId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const defaults = externalIdentityProviderDefaults[parsed.output.type]
  const scopes = parsed.output.scopes ?? [...defaults.scopes]
  return storageTransactionRun(options.database, (transaction) => {
    const repository = externalIdentityRepositoryCreate(transaction)
    const duplicate = transaction
      .select({ id: externalIdentityProviderTable.id })
      .from(externalIdentityProviderTable)
      .where(
        and(
          eq(externalIdentityProviderTable.realmId, options.realmId),
          eq(externalIdentityProviderTable.type, parsed.output.type),
          parsed.output.organizationId === undefined
            ? isNull(externalIdentityProviderTable.organizationId)
            : eq(externalIdentityProviderTable.organizationId, parsed.output.organizationId),
        ),
      )
      .get()
    if (duplicate !== undefined)
      return resultErrorCreate(
        op,
        "An external identity provider with that scope already exists.",
        "external-identities.already-exists",
      )
    const created = repository.externalIdentityProviderCreate({
      allowAccountCreation: parsed.output.allowAccountCreation,
      clientId: parsed.output.clientId,
      clientSecret: parsed.output.clientSecret,
      createdAt: now,
      displayName: parsed.output.displayName,
      enabled: true,
      id: providerId,
      realmId: options.realmId,
      organizationId: parsed.output.organizationId ?? null,
      redirectUri: parsed.output.redirectUri,
      scopes: JSON.stringify(scopes),
      type: parsed.output.type,
      updatedAt: now,
      version: 1,
    })
    if (!created.success)
      return resultErrorCreate(
        op,
        "An external identity provider with that scope already exists.",
        "external-identities.already-exists",
      )
    const payload = v.safeParse(externalIdentityEventPayloadSchema, {
      action: "provider_created",
      providerId,
      providerType: parsed.output.type,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The provider event payload is invalid.", "external-identities.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: providerId,
        aggregateType: "external_identity_provider",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: externalIdentityEventTypes.providerCreated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "external_identities" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ provider: externalIdentityProviderViewCreate(created.data) })
  })
}
