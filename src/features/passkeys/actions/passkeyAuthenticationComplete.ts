import {
  type VerifiedAuthenticationResponse,
  verifyAuthenticationResponse,
  type WebAuthnCredential,
} from "@simplewebauthn/server"
import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { sessionCredentialCreate } from "../../sessions/domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../../sessions/domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../../sessions/domain/sessionPublicViewCreate.js"
import { sessionEventTypes } from "../../sessions/events/sessionEventTypes.js"
import { sessionRotatedEventPayloadSchema } from "../../sessions/events/sessionRotatedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../../sessions/persistence/sessionRepositoryCreate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { passkeyChallengeHashCreate } from "../domain/passkeyChallengeHashCreate.js"
import { passkeyConfigurationValidate } from "../domain/passkeyConfigurationValidate.js"
import { passkeyTokenHashCreate } from "../domain/passkeyTokenHashCreate.js"
import { passkeyUserHandleCreate } from "../domain/passkeyUserHandleCreate.js"
import { passkeyEventPayloadSchema } from "../events/passkeyEventPayloadSchema.js"
import { passkeyEventTypes } from "../events/passkeyEventTypes.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyAuthenticationCompleteRequest } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import { passkeyAuthenticationCompleteRequestSchema } from "../public/passkeyAuthenticationCompleteRequestSchema.js"
import type { PasskeyAuthenticationCompleteResponse } from "../public/passkeyAuthenticationCompleteResponseSchema.js"

type PasskeyAuthenticationCompleteOptions = {
  readonly database: StorageDatabase
  readonly input: PasskeyAuthenticationCompleteRequest
  readonly realmId: string
  readonly origins: readonly string[]
  readonly rpId: string
  readonly rpName: string
  readonly expectedPurpose?: "mfa" | "step_up"
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
  readonly actorId?: string | null
  readonly correlationId?: string
}

export async function passkeyAuthenticationComplete(
  options: PasskeyAuthenticationCompleteOptions,
): Promise<Result<PasskeyAuthenticationCompleteResponse>> {
  const op = "passkeyAuthenticationComplete"
  const input = v.safeParse(passkeyAuthenticationCompleteRequestSchema, options.input)
  if (!input.success)
    return resultErrorCreate(op, "The passkey authentication response is invalid.", "passkeys.invalid")
  const configuration = passkeyConfigurationValidate(options.rpId, options.origins, options.rpName)
  if (!configuration.success) return configuration
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The passkey timestamp is invalid.", "passkeys.invalid-timestamp")
  const tokenHash = passkeyTokenHashCreate(input.output.token)
  const repository = passkeyRepositoryCreate(options.database.db)
  const ceremony = repository.passkeyCeremonyGetByTokenHash(options.realmId, tokenHash)
  if (!ceremony.success) return ceremony
  if (
    ceremony.data === null ||
    ceremony.data.kind !== "authentication" ||
    ceremony.data.consumedAt !== null ||
    ceremony.data.expiresAt <= now
  )
    return resultErrorCreate(op, "The passkey authentication ceremony is invalid.", "passkeys.invalid")
  if (options.expectedPurpose !== undefined && ceremony.data.purpose !== options.expectedPurpose)
    return resultErrorCreate(op, "The passkey authentication ceremony is invalid.", "passkeys.invalid")
  if (ceremony.data.purpose === "passwordless") {
    const policy = organizationLoginPolicyEnforce({
      database: options.database,
      realmId: options.realmId,
      method: "passkey",
      organizationId: ceremony.data.organizationId ?? undefined,
    })
    if (!policy.success)
      return resultErrorCreate(op, "The passkey login method is disabled for this organization.", "passkeys.conflict")
  }
  const origins = passkeyOriginsParse(ceremony.data.origins)
  if (origins === null)
    return resultErrorCreate(op, "The passkey authentication ceremony is invalid.", "passkeys.invalid")
  const storedConfiguration = passkeyConfigurationValidate(ceremony.data.rpId, origins, options.rpName)
  if (
    !storedConfiguration.success ||
    storedConfiguration.data.rpId !== configuration.data.rpId ||
    !passkeyOriginsEqual(storedConfiguration.data.origins, configuration.data.origins)
  )
    return resultErrorCreate(op, "The passkey authentication ceremony is invalid.", "passkeys.invalid")
  const credential = repository.passkeyCredentialGetByCredentialId(
    options.realmId,
    ceremony.data.rpId,
    input.output.response.id,
  )
  if (!credential.success) return credential
  if (
    credential.data === null ||
    credential.data.revokedAt !== null ||
    (ceremony.data.userId !== null && credential.data.userId !== ceremony.data.userId)
  )
    return resultErrorCreate(op, "The passkey authentication response is invalid.", "passkeys.invalid")
  const user = options.database.db
    .select({ state: userTable.state })
    .from(userTable)
    .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, credential.data.userId)))
    .get()
  if (user?.state !== "active")
    return resultErrorCreate(op, "The passkey authentication response is invalid.", "passkeys.invalid")
  const webAuthnCredential: WebAuthnCredential = {
    counter: credential.data.counter,
    id: credential.data.credentialId,
    publicKey: Uint8Array.from(credential.data.publicKey),
    transports: passkeyTransportsParse(credential.data.transports),
  }
  let verified: VerifiedAuthenticationResponse
  try {
    verified = await verifyAuthenticationResponse({
      credential: webAuthnCredential,
      expectedChallenge: (challenge) => passkeyChallengeHashCreate(challenge) === ceremony.data!.challengeHash,
      expectedOrigin: storedConfiguration.data.origins as string[],
      expectedRPID: storedConfiguration.data.rpId,
      expectedType: "webauthn.get",
      requireUserVerification: true,
      response: input.output.response,
    })
  } catch (_error) {
    return resultErrorCreate(op, "The passkey authentication response is invalid.", "passkeys.invalid")
  }
  if (!verified.verified)
    return resultErrorCreate(op, "The passkey authentication response is invalid.", "passkeys.invalid")
  if (verified.authenticationInfo.credentialID !== credential.data.credentialId)
    return resultErrorCreate(op, "The passkey credential ID is invalid.", "passkeys.invalid")
  if (!passkeyUserHandleMatches(input.output.response.response.userHandle, credential.data.userId))
    return resultErrorCreate(op, "The passkey user handle is invalid.", "passkeys.invalid")
  if (ceremony.data.purpose !== "passwordless" && options.sessionToken === undefined)
    return resultErrorCreate(op, "The passkey session is required.", "passkeys.unauthorized")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) =>
    passkeyAuthenticationCompleteTransaction({
      actorId: options.actorId,
      correlationId,
      database: transaction,
      realmId: options.realmId,
      input: input.output,
      now,
      runtime,
      sessionToken: options.sessionToken,
      tokenHash,
      verified,
    }),
  )
}

type PasskeyAuthenticationCompleteTransactionOptions = {
  readonly actorId?: string | null
  readonly correlationId: string
  readonly database: Parameters<typeof passkeyRepositoryCreate>[0]
  readonly realmId: string
  readonly input: PasskeyAuthenticationCompleteRequest
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
  readonly tokenHash: string
  readonly verified: VerifiedAuthenticationResponse
}

function passkeyAuthenticationCompleteTransaction(
  options: PasskeyAuthenticationCompleteTransactionOptions,
): Result<PasskeyAuthenticationCompleteResponse> {
  const op = "passkeyAuthenticationComplete"
  const repository = passkeyRepositoryCreate(options.database)
  const ceremony = repository.passkeyCeremonyGetByTokenHash(options.realmId, options.tokenHash)
  if (!ceremony.success) return ceremony
  if (
    ceremony.data === null ||
    ceremony.data.kind !== "authentication" ||
    ceremony.data.consumedAt !== null ||
    ceremony.data.expiresAt <= options.now
  )
    return resultErrorCreate(op, "The passkey authentication ceremony is invalid.", "passkeys.invalid")
  const credentialId = options.input.response.id
  const credential = repository.passkeyCredentialGetByCredentialId(options.realmId, ceremony.data.rpId, credentialId)
  if (!credential.success) return credential
  if (
    credential.data === null ||
    credential.data.revokedAt !== null ||
    (ceremony.data.userId !== null && credential.data.userId !== ceremony.data.userId)
  )
    return resultErrorCreate(op, "The passkey authentication response is invalid.", "passkeys.invalid")
  const consumed = repository.passkeyCeremonyConsume(
    options.realmId,
    ceremony.data.id,
    options.tokenHash,
    ceremony.data.version,
    options.now,
  )
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultErrorCreate(op, "The passkey authentication ceremony is invalid.", "passkeys.invalid")
  const newCounter = options.verified.authenticationInfo.newCounter
  if ((newCounter > 0 || credential.data.counter > 0) && newCounter <= credential.data.counter)
    return resultErrorCreate(op, "The passkey authenticator counter is invalid.", "passkeys.invalid")
  const updated = repository.passkeyCredentialCounterUpdate(
    options.realmId,
    credential.data.id,
    credential.data.version,
    newCounter,
    options.verified.authenticationInfo.credentialBackedUp,
    options.now,
  )
  if (!updated.success) return updated
  if (updated.data === null)
    return resultErrorCreate(op, "The passkey authentication response is invalid.", "passkeys.invalid")
  const credentialVersion = repository.passkeyEventVersionGet(options.realmId, "passkey_credential", credential.data.id)
  if (!credentialVersion.success) return credentialVersion
  const credentialPayload = v.safeParse(passkeyEventPayloadSchema, {
    backedUp: options.verified.authenticationInfo.credentialBackedUp,
    counter: newCounter,
    credentialId: credential.data.id,
    userId: credential.data.userId,
    userVerified: options.verified.authenticationInfo.userVerified,
  })
  if (!credentialPayload.success)
    return resultErrorCreate(op, "The passkey event payload is invalid.", "passkeys.event-invalid")
  const credentialEvent = storageEventAppend(
    options.database,
    {
      actorId: options.actorId ?? credential.data.userId,
      aggregateId: credential.data.id,
      aggregateType: "passkey_credential",
      aggregateVersion: credentialVersion.data + 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: passkeyEventTypes.credentialUsed,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passkeys" },
      occurredAt: options.now,
      payload: credentialPayload.output,
    },
    options.runtime,
  )
  if (!credentialEvent.success) return credentialEvent
  const authenticationPayload = v.safeParse(passkeyEventPayloadSchema, {
    ceremonyId: ceremony.data.id,
    purpose: ceremony.data.purpose,
    userId: credential.data.userId,
    userVerified: options.verified.authenticationInfo.userVerified,
  })
  if (!authenticationPayload.success)
    return resultErrorCreate(op, "The passkey event payload is invalid.", "passkeys.event-invalid")
  const authenticationEvent = storageEventAppend(
    options.database,
    {
      actorId: options.actorId ?? credential.data.userId,
      aggregateId: ceremony.data.id,
      aggregateType: "passkey_ceremony",
      aggregateVersion: consumed.data.version,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: passkeyEventTypes.authenticationCompleted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passkeys" },
      occurredAt: options.now,
      payload: authenticationPayload.output,
    },
    options.runtime,
  )
  if (!authenticationEvent.success) return authenticationEvent
  const authentication = {
    authenticatedAt: options.now,
    realmId: options.realmId,
    userId: credential.data.userId,
  }
  if (ceremony.data.purpose === "passwordless") {
    const session = sessionIssue({
      actorId: options.actorId ?? credential.data.userId,
      assurance: "authenticated",
      authenticationMethod: "passkey",
      commandIndex: 2,
      correlationId: options.correlationId,
      executor: options.database,
      realmId: options.realmId,
      runtime: options.runtime,
      userId: credential.data.userId,
    })
    if (!session.success)
      return resultErrorCreate(op, "The passkey session could not be created.", "passkeys.write-failed")
    return resultCreate({
      authentication: {
        authenticatedAt: authentication.authenticatedAt,
        realmId: authentication.realmId,
        userId: authentication.userId,
      },
      session: session.data,
    })
  }
  return passkeySessionAssuranceRotate(options, ceremony.data.sessionId, credential.data.userId, authentication)
}

function passkeySessionAssuranceRotate(
  options: PasskeyAuthenticationCompleteTransactionOptions,
  sessionId: string | null,
  userId: string,
  authentication: PasskeyAuthentication,
): Result<PasskeyAuthenticationCompleteResponse> {
  const op = "passkeyAuthenticationComplete"
  if (sessionId === null || options.sessionToken === undefined)
    return resultErrorCreate(op, "The passkey session is required.", "passkeys.unauthorized")
  const current = options.database
    .select()
    .from(sessionTable)
    .where(
      and(eq(sessionTable.realmId, options.realmId), eq(sessionTable.id, sessionId), eq(sessionTable.userId, userId)),
    )
    .get()
  if (
    current === undefined ||
    current.tokenHash !== sessionCredentialHashCreate(options.sessionToken) ||
    current.revokedAt !== null ||
    current.expiresAt <= options.now
  )
    return resultErrorCreate(op, "The passkey session is invalid.", "passkeys.invalid")
  const nextToken = sessionCredentialCreate(options.runtime)
  const rotated = sessionRepositoryCreate(options.database).sessionAssuranceRotate(
    options.realmId,
    current.id,
    current.tokenHash,
    sessionCredentialHashCreate(nextToken),
    options.now,
    current.version,
    current.version + 1,
    "passkey",
  )
  if (!rotated.success) return rotated
  if (rotated.data === null) return resultErrorCreate(op, "The passkey session is invalid.", "passkeys.invalid")
  const eventVersion = sessionRepositoryCreate(options.database).sessionEventVersionGet(options.realmId, current.id)
  if (!eventVersion.success) return eventVersion
  const payload = v.safeParse(sessionRotatedEventPayloadSchema, { rotatedAt: options.now, sessionId: current.id })
  if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.", "passkeys.event-invalid")
  const event = storageEventAppend(
    options.database,
    {
      actorId: userId,
      aggregateId: current.id,
      aggregateType: "session",
      aggregateVersion: eventVersion.data + 1,
      commandIndex: 2,
      correlationId: options.correlationId,
      eventType: sessionEventTypes.rotated,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "sessions" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({
    authentication: {
      authenticatedAt: authentication.authenticatedAt,
      realmId: authentication.realmId,
      userId: authentication.userId,
    },
    session: { session: sessionPublicViewCreate(rotated.data, true), token: nextToken },
  })
}

type PasskeyAuthentication = {
  readonly authenticatedAt: number
  readonly realmId: string
  readonly userId: string
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

function passkeyUserHandleMatches(userHandle: string | undefined, userId: string): boolean {
  if (userHandle === undefined) return false
  return userHandle === passkeyUserHandleCreate(userId)
}

function passkeyTransportsParse(
  value: string,
): ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb" =>
      ["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"].includes(item as string),
    )
  } catch (_error) {
    return []
  }
}
