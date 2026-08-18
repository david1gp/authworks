import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcSigningKeyRetiredEventPayloadSchema } from "../events/oidcSigningKeyRetiredEventPayloadSchema.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import {
  type OidcSigningKeyLifecycleRequest,
  oidcSigningKeyLifecycleRequestSchema,
} from "../public/oidcSigningKeyLifecycleRequestSchema.js"
import type { OidcSigningKeyResponse } from "../public/oidcSigningKeyResponseSchema.js"

type OidcSigningKeyLifecycleSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OidcSigningKeyLifecycleRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly signingKeyId: string
  readonly correlationId?: string
}

export function oidcSigningKeyLifecycleSet(options: OidcSigningKeyLifecycleSetOptions): Result<OidcSigningKeyResponse> {
  const op = "oidcSigningKeyLifecycleSet"
  const parsed = v.safeParse(oidcSigningKeyLifecycleRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The signing key lifecycle request is invalid.")
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const retiredAt = runtime.now()
  if (!Number.isSafeInteger(retiredAt) || retiredAt < 0)
    return resultErrorCreate(op, "The signing key timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const current = repository.signingKeyGet(options.realmId, options.signingKeyId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The signing key was not found.")
    if (current.data.status === "retired") return resultErrorCreate(op, "The signing key is already retired.")
    const updated = repository.signingKeyUpdate(options.realmId, options.signingKeyId, {
      retiredAt,
      status: parsed.output.status,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The signing key was not found.")
    const payload = v.safeParse(oidcSigningKeyRetiredEventPayloadSchema, { status: "retired" })
    if (!payload.success) return resultErrorCreate(op, "The signing key event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.signingKeyId,
        aggregateType: "oidc_signing_key",
        aggregateVersion: 2,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.signingKeyRetired,
        realmId: options.realmId,
        metadata: { source: "oidc", reason: "lifecycle" },
        occurredAt: retiredAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const signingKey = oidcSigningKeyPublicViewCreate(updated.data)
    if (!signingKey.success) return signingKey
    return resultCreate({ signingKey: signingKey.data })
  })
}
