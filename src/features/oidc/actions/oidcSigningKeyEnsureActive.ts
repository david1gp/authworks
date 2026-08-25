import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcKeyMaterialCreate } from "../domain/oidcKeyMaterialCreate.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcValueEncrypt } from "../domain/oidcValueEncrypt.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcSigningKeyCreatedEventPayloadSchema } from "../events/oidcSigningKeyCreatedEventPayloadSchema.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcSigningKeyEnsureResponse } from "../public/oidcSigningKeyEnsureResponseSchema.js"

type OidcSigningKeyEnsureActiveOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcSigningKeyEnsureActive(
  options: OidcSigningKeyEnsureActiveOptions,
): Result<OidcSigningKeyEnsureResponse> {
  const op = "oidcSigningKeyEnsureActive"
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

  const runtime = options.runtime ?? options.database.runtime
  return storageTransactionRun<OidcSigningKeyEnsureResponse>(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const listed = repository.signingKeyList(options.realmId)
    if (!listed.success) return listed
    const active = []
    for (const row of listed.data) {
      const signingKey = oidcSigningKeyPublicViewCreate(row)
      if (!signingKey.success) return signingKey
      if (signingKey.data.status === "active") active.push(signingKey.data)
    }
    if (active.length > 1) return resultErrorCodedCreate(op, "More than one signing key is active.", "oidc.conflict")
    const existing = active[0]
    if (existing !== undefined) {
      if (existing.retiredAt !== null || existing.id !== existing.publicJwk.kid)
        return resultErrorCodedCreate(op, "The active signing key is invalid.", "oidc.invalid")
      return resultCreate({ action: "reused" as const, signingKey: existing })
    }

    const createdAt = runtime.now()
    if (!Number.isSafeInteger(createdAt) || createdAt < 0)
      return resultErrorCodedCreate(op, "The signing key timestamp is invalid.", "oidc.invalid-timestamp")
    const keyId = uuidv7Create(runtime)
    const material = oidcKeyMaterialCreate()
    if (!material.success) return material
    const encrypted = oidcValueEncrypt(material.data.privateKey, options.realmId, options.encryptionSecret)
    if (!encrypted.success) return encrypted
    const created = repository.signingKeyCreate({
      algorithm: "RS256",
      createdAt,
      encryptedPrivateKey: encrypted.data,
      id: keyId,
      realmId: options.realmId,
      publicJwk: JSON.stringify({ ...material.data.publicJwk, kid: keyId }),
      retiredAt: null,
      status: "active",
    })
    if (!created.success) return created
    const payload = v.safeParse(oidcSigningKeyCreatedEventPayloadSchema, { algorithm: "RS256" })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The signing key event payload is invalid.", "oidc.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: keyId,
        aggregateType: "oidc_signing_key",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId: options.correlationId ?? uuidv7Create(runtime),
        eventType: oidcEventTypes.signingKeyCreated,
        realmId: options.realmId,
        metadata: { source: "oidc", reason: "ensure" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const signingKey = oidcSigningKeyPublicViewCreate(created.data)
    if (!signingKey.success) return signingKey
    return resultCreate({ action: "created" as const, signingKey: signingKey.data })
  })
}
