import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userEmailRepositoryCreate } from "../../users/persistence/userEmailRepositoryCreate.js"
import { passwordTokenCreate } from "../domain/passwordTokenCreate.js"
import { passwordTokenHashCreate } from "../domain/passwordTokenHashCreate.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordRecoveryEventPayloadSchema } from "../events/passwordRecoveryEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import { type PasswordRecoveryDelivery } from "../public/passwordRecoveryDeliverySchema.js"
import { type PasswordRecoveryRequest, passwordRecoveryRequestSchema } from "../public/passwordRecoveryRequestSchema.js"
import type { PasswordRecoveryResponse } from "../public/passwordRecoveryResponseSchema.js"

type PasswordRecoveryRequestOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordRecoveryRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly onRecoveryToken?: (delivery: PasswordRecoveryDelivery) => void
}

export function passwordRecoveryRequest(options: PasswordRecoveryRequestOptions): Result<PasswordRecoveryResponse> {
  const op = "passwordRecoveryRequest"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The recovery is not available in this tenant context.", "passwords.tenant-mismatch")
  const parsed = v.safeParse(passwordRecoveryRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The recovery request is invalid.", "passwords.invalid")
  const email = userEmailNormalize(parsed.output.email)
  if (!email.success) return resultCreate({ accepted: true })
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return resultCreate({ accepted: true })
  if (realm.data.realm.status !== "active") return resultCreate({ accepted: true })
  const policy = organizationLoginPolicyResolve({
    database: options.database,
    realmId: options.realmId,
    organizationId: parsed.output.organizationId,
  })
  if (!policy.success || !policy.data.allowPasswordRecovery) return resultCreate({ accepted: true })
  const repository = passwordRepositoryCreate(options.database.db)
  const address = userEmailRepositoryCreate(options.database.db).userEmailGetByVerifiedAddress(
    options.realmId,
    email.data,
  )
  if (!address.success || address.data === null) return resultCreate({ accepted: true })
  const user = repository.passwordUserGet(options.realmId, address.data.userId)
  if (!user.success || user.data === null || user.data.state === "deleted") return resultCreate({ accepted: true })
  const userRow = user.data
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The recovery timestamp is invalid.", "passwords.invalid-timestamp")
  const token = passwordTokenCreate(runtime)
  const challengeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const created = storageTransactionRun(options.database, (transaction) => {
    const txRepository = passwordRepositoryCreate(transaction)
    const expired = txRepository.passwordChallengeExpirePrevious(options.realmId, userRow.id, "recovery", now)
    if (!expired.success) return expired
    const challenge = txRepository.passwordChallengeCreate({
      createdAt: now,
      expiresAt: now + 60 * 60 * 1_000,
      id: challengeId,
      realmId: options.realmId,
      kind: "recovery",
      tokenHash: passwordTokenHashCreate(token.valueGet()),
      userId: userRow.id,
      version: 1,
    })
    if (!challenge.success) return challenge
    const eventVersion = txRepository.passwordEventVersionGet(options.realmId, userRow.id)
    if (!eventVersion.success)
      return resultErrorCreate(op, "The recovery event version is invalid.", "passwords.invalid")
    const payload = v.safeParse(passwordRecoveryEventPayloadSchema, { accepted: true })
    if (!payload.success)
      return resultErrorCreate(op, "The recovery event payload is invalid.", "passwords.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: userRow.id,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: passwordEventTypes.recoveryRequested,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: userRow.id,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate(undefined)
  })
  if (!created.success) return created
  try {
    options.onRecoveryToken?.({
      email: address.data.email,
      realmId: options.realmId,
      token: token.valueGet(),
      userId: userRow.id,
    })
  } catch (_error) {}
  return resultCreate({ accepted: true })
}
