import { type VerifiedRegistrationResponse, verifyRegistrationResponse } from "@simplewebauthn/server"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { passkeyChallengeHashCreate } from "../domain/passkeyChallengeHashCreate.js"
import { passkeyConfigurationValidate } from "../domain/passkeyConfigurationValidate.js"
import { passkeyCredentialViewCreate } from "../domain/passkeyCredentialViewCreate.js"
import { passkeyTokenHashCreate } from "../domain/passkeyTokenHashCreate.js"
import { passkeyEventPayloadSchema } from "../events/passkeyEventPayloadSchema.js"
import { passkeyEventTypes } from "../events/passkeyEventTypes.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyRegistrationCompleteRequest } from "../public/passkeyRegistrationCompleteRequestSchema.js"
import { passkeyRegistrationCompleteRequestSchema } from "../public/passkeyRegistrationCompleteRequestSchema.js"
import type { PasskeyRegistrationCompleteResponse } from "../public/passkeyRegistrationCompleteResponseSchema.js"

type PasskeyRegistrationCompleteOptions = {
  readonly database: StorageDatabase
  readonly input: PasskeyRegistrationCompleteRequest
  readonly realmId: string
  readonly origins: readonly string[]
  readonly rpId: string
  readonly rpName: string
  readonly userId?: string
  readonly actorId?: string | null
  readonly correlationId?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export async function passkeyRegistrationComplete(
  options: PasskeyRegistrationCompleteOptions,
): Promise<Result<PasskeyRegistrationCompleteResponse>> {
  const op = "passkeyRegistrationComplete"
  const input = v.safeParse(passkeyRegistrationCompleteRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The passkey registration response is invalid.", "passkeys.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The passkey timestamp is invalid.", "passkeys.invalid-timestamp")
  const configuration = passkeyConfigurationValidate(options.rpId, options.origins, options.rpName)
  if (!configuration.success)
    return resultErrorCreate(op, "The passkey registration ceremony is invalid.", "passkeys.invalid")
  const tokenHash = passkeyTokenHashCreate(input.output.token)
  const ceremony = passkeyRepositoryCreate(options.database.db).passkeyCeremonyGetByTokenHash(
    options.realmId,
    tokenHash,
  )
  if (!ceremony.success) return ceremony
  if (
    ceremony.data === null ||
    ceremony.data.kind !== "registration" ||
    ceremony.data.consumedAt !== null ||
    ceremony.data.expiresAt <= now ||
    ceremony.data.userId === null ||
    (options.userId !== undefined && ceremony.data.userId !== options.userId)
  )
    return resultErrorCreate(op, "The passkey registration ceremony is invalid.", "passkeys.invalid")
  const origins = passkeyOriginsParse(ceremony.data.origins)
  if (origins === null)
    return resultErrorCreate(op, "The passkey registration ceremony is invalid.", "passkeys.invalid")
  const storedConfiguration = passkeyConfigurationValidate(ceremony.data.rpId, origins, options.rpName)
  if (
    !storedConfiguration.success ||
    storedConfiguration.data.rpId !== options.rpId ||
    !passkeyOriginsEqual(storedConfiguration.data.origins, configuration.data.origins)
  )
    return resultErrorCreate(op, "The passkey registration ceremony is invalid.", "passkeys.invalid")
  let verified: VerifiedRegistrationResponse
  try {
    verified = await verifyRegistrationResponse({
      expectedChallenge: (challenge) => passkeyChallengeHashCreate(challenge) === ceremony.data!.challengeHash,
      expectedOrigin: storedConfiguration.data.origins as string[],
      expectedRPID: storedConfiguration.data.rpId,
      expectedType: "webauthn.create",
      requireUserPresence: true,
      requireUserVerification: ceremony.data.userVerification === "required",
      response: input.output.response,
    })
  } catch (_error) {
    return resultErrorCreate(op, "The passkey registration response is invalid.", "passkeys.invalid")
  }
  if (!verified.verified)
    return resultErrorCreate(op, "The passkey registration response is invalid.", "passkeys.invalid")
  if (verified.registrationInfo.credential.id.length > 500)
    return resultErrorCreate(op, "The passkey credential ID is invalid.", "passkeys.invalid")
  if (verified.registrationInfo.credential.id !== input.output.response.rawId)
    return resultErrorCreate(op, "The passkey credential ID is invalid.", "passkeys.invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) =>
    passkeyRegistrationCompleteTransaction({
      actorId: options.actorId,
      correlationId,
      database: transaction,
      realmId: options.realmId,
      now,
      runtime,
      tokenHash,
      verified,
    }),
  )
}

type PasskeyRegistrationCompleteTransactionOptions = {
  readonly actorId?: string | null
  readonly correlationId: string
  readonly database: StorageTransaction
  readonly realmId: string
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly tokenHash: string
  readonly verified: Extract<VerifiedRegistrationResponse, { verified: true }>
}

function passkeyRegistrationCompleteTransaction(
  options: PasskeyRegistrationCompleteTransactionOptions,
): Result<PasskeyRegistrationCompleteResponse> {
  const op = "passkeyRegistrationComplete"
  const repository = passkeyRepositoryCreate(options.database)
  const ceremony = repository.passkeyCeremonyGetByTokenHash(options.realmId, options.tokenHash)
  if (!ceremony.success) return ceremony
  if (
    ceremony.data === null ||
    ceremony.data.kind !== "registration" ||
    ceremony.data.consumedAt !== null ||
    ceremony.data.expiresAt <= options.now ||
    ceremony.data.userId === null
  )
    return resultErrorCreate(op, "The passkey registration ceremony is invalid.", "passkeys.invalid")
  const credential = options.verified.registrationInfo.credential
  const consumed = repository.passkeyCeremonyConsume(
    options.realmId,
    ceremony.data.id,
    options.tokenHash,
    ceremony.data.version,
    options.now,
  )
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultErrorCreate(op, "The passkey registration ceremony is invalid.", "passkeys.invalid")
  const created = repository.passkeyCredentialCreate({
    aaguid: options.verified.registrationInfo.aaguid,
    backedUp: options.verified.registrationInfo.credentialBackedUp ? 1 : 0,
    counter: credential.counter,
    createdAt: options.now,
    credentialId: credential.id,
    deviceType: options.verified.registrationInfo.credentialDeviceType,
    id: uuidv7Create(options.runtime),
    realmId: options.realmId,
    lastUsedAt: null,
    publicKey: Buffer.from(credential.publicKey),
    revokedAt: null,
    rpId: ceremony.data.rpId,
    transports: JSON.stringify(credential.transports ?? []),
    userId: ceremony.data.userId,
    version: 1,
  })
  if (!created.success)
    return resultErrorCreate(op, "The passkey credential is already registered.", "passkeys.already-exists")
  const credentialPayload = v.safeParse(passkeyEventPayloadSchema, {
    backedUp: options.verified.registrationInfo.credentialBackedUp,
    credentialId: created.data.id,
    counter: credential.counter,
    userId: ceremony.data.userId,
    userVerified: options.verified.registrationInfo.userVerified,
  })
  if (!credentialPayload.success)
    return resultErrorCreate(op, "The passkey event payload is invalid.", "passkeys.event-invalid")
  const credentialEvent = eventSecurityEventAppend(
    options.database,
    {
      actorId: options.actorId ?? ceremony.data.userId,
      aggregateId: created.data.id,
      aggregateType: "passkey_credential",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: passkeyEventTypes.registrationCompleted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passkeys" },
      occurredAt: options.now,
      payload: credentialPayload.output,
      userSubjectId: ceremony.data.userId,
    },
    options.runtime,
  )
  if (!credentialEvent.success) return credentialEvent
  const ceremonyPayload = v.safeParse(passkeyEventPayloadSchema, {
    ceremonyId: ceremony.data.id,
    credentialId: created.data.id,
    purpose: ceremony.data.purpose,
    userId: ceremony.data.userId,
  })
  if (!ceremonyPayload.success)
    return resultErrorCreate(op, "The passkey event payload is invalid.", "passkeys.event-invalid")
  const ceremonyEvent = eventSecurityEventAppend(
    options.database,
    {
      actorId: options.actorId ?? ceremony.data.userId,
      aggregateId: ceremony.data.id,
      aggregateType: "passkey_ceremony",
      aggregateVersion: consumed.data.version,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: passkeyEventTypes.registrationCompleted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passkeys" },
      occurredAt: options.now,
      payload: ceremonyPayload.output,
      userSubjectId: ceremony.data.userId,
    },
    options.runtime,
  )
  if (!ceremonyEvent.success) return ceremonyEvent
  return resultCreate({ credential: passkeyCredentialViewCreate(created.data) })
}

function passkeyOriginsParse(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) return null
    return parsed
  } catch (_error) {
    return null
  }
}

function passkeyOriginsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((origin, index) => origin === right[index])
}
