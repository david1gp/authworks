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
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../sessions/actions/sessionAuthenticate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcConsentRevokedEventPayloadSchema } from "../events/oidcConsentRevokedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcConsentRevokeResponse } from "../public/oidcConsentRevokeResponseSchema.js"

type OidcConsentRevokeOptions = {
  readonly context?: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly clientId: string
  readonly userId?: string
  readonly sessionToken?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcConsentRevoke(options: OidcConsentRevokeOptions): Result<OidcConsentRevokeResponse> {
  const op = "oidcConsentRevoke"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(op, "The OIDC consent timestamp is invalid.", "oidc.invalid-timestamp")
  let userId = options.userId
  let actorId = options.userId
  if (options.sessionToken !== undefined) {
    const authenticated = sessionAuthenticate({
      database: options.database,
      realmId: options.realmId,
      runtime,
      token: options.sessionToken,
    })
    if (!authenticated.success)
      return resultErrorCodedCreate(op, "Session authorization is required.", "oidc.unauthorized")
    userId = authenticated.data.actor.actorId
    actorId = userId
  }
  if (userId === undefined || userId.length === 0)
    return resultErrorCodedCreate(op, "The consent user is required.", "oidc.invalid")
  if (options.context !== undefined) {
    const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
    if (!authorized.success) return authorized
    const realm = realmGet({
      context: realmSystemContextCreate(),
      database: options.database,
      realmId: options.realmId,
    })
    if (!realm.success) return realm
  }
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun<OidcConsentRevokeResponse>(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const revoked = repository.consentRevoke(options.realmId, userId as string, options.clientId, now)
    if (!revoked.success) return revoked
    if (revoked.data === null) return resultCreate({ revoked: false })
    const payload = v.safeParse(oidcConsentRevokedEventPayloadSchema, {
      clientId: options.clientId,
      userId: userId as string,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The consent event payload is invalid.", "oidc.event-invalid")
    const consentVersion = repository.consentEventVersionGet(options.realmId, userId as string, options.clientId)
    if (!consentVersion.success) return consentVersion
    const event = storageEventAppend(
      transaction,
      {
        actorId,
        aggregateId: `${userId}:${options.clientId}`,
        aggregateType: "oidc_consent",
        aggregateVersion: consentVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.consentRevoked,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ revoked: true })
  })
}
