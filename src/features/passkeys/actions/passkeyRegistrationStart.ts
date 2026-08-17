import { generateRegistrationOptions } from "@simplewebauthn/server"
import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { userTable } from "../../users/persistence/userTable.js"
import { passkeyChallengeHashCreate } from "../domain/passkeyChallengeHashCreate.js"
import { passkeyConfigurationValidate } from "../domain/passkeyConfigurationValidate.js"
import { passkeyEventPayloadSchema } from "../events/passkeyEventPayloadSchema.js"
import { passkeyEventTypes } from "../events/passkeyEventTypes.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyRegistrationStartResponse } from "../public/passkeyRegistrationStartResponseSchema.js"
import { passkeyRegistrationStartResponseSchema } from "../public/passkeyRegistrationStartResponseSchema.js"
import { passkeyUserHandleCreate } from "../domain/passkeyUserHandleCreate.js"
import { passkeyTokenHashCreate } from "../domain/passkeyTokenHashCreate.js"

type PasskeyRegistrationStartOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly origins: readonly string[]
  readonly rpId: string
  readonly rpName: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly actorId?: string | null
  readonly correlationId?: string
}

export async function passkeyRegistrationStart(
  options: PasskeyRegistrationStartOptions,
): Promise<Result<PasskeyRegistrationStartResponse>> {
  const op = "passkeyRegistrationStart"
  const configuration = passkeyConfigurationValidate(options.rpId, options.origins, options.rpName)
  if (!configuration.success) return configuration
  const user = options.database.db
    .select({ email: userTable.email, id: userTable.id, state: userTable.state, userName: userTable.userName })
    .from(userTable)
    .where(and(eq(userTable.instanceId, options.instanceId), eq(userTable.id, options.userId)))
    .get()
  if (user === undefined || user.state !== "active") return resultErrorCreate(op, "The passkey user is invalid.")
  const credentials = passkeyRepositoryCreate(options.database.db).passkeyCredentialList(
    options.instanceId,
    options.userId,
  )
  if (!credentials.success) return credentials
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The passkey timestamp is invalid.")
  const token = Buffer.from(runtime.randomBytes(32)).toString("base64url")
  const challenge = Buffer.from(runtime.randomBytes(32)).toString("base64url")
  let generated: Awaited<ReturnType<typeof generateRegistrationOptions>>
  try {
    generated = await generateRegistrationOptions({
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      challenge: Buffer.from(challenge, "base64url"),
      excludeCredentials: credentials.data
        .filter((credential) => credential.revokedAt === null)
        .map((credential) => ({
          id: credential.credentialId,
          transports: passkeyTransportsParse(credential.transports),
        })),
      rpID: configuration.data.rpId,
      rpName: configuration.data.rpName,
      timeout: 60_000,
      userDisplayName: user.userName,
      userID: Buffer.from(passkeyUserHandleCreate(user.id), "base64url"),
      userName: user.email,
    })
  } catch (_error) {
    return resultErrorCreate(op, "The passkey registration options could not be created.")
  }
  const parsed = await passkeyRegistrationStartStore({
    actorId: options.actorId,
    challenge,
    configuration: configuration.data,
    correlationId: options.correlationId,
    database: options.database,
    instanceId: options.instanceId,
    now,
    purpose: "mfa",
    runtime,
    token,
    userId: options.userId,
  })
  if (!parsed.success) return parsed
  const response = v.safeParse(passkeyRegistrationStartResponseSchema, { options: generated, token })
  if (!response.success) return resultErrorCreate(op, "The passkey registration options are invalid.")
  return resultCreate(response.output)
}

type PasskeyRegistrationStartStoreOptions = {
  readonly actorId?: string | null
  readonly challenge: string
  readonly configuration: { readonly origins: readonly string[]; readonly rpId: string; readonly rpName: string }
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly now: number
  readonly purpose: "mfa"
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
  readonly userId: string
}

function passkeyRegistrationStartStore(options: PasskeyRegistrationStartStoreOptions): Result<void> {
  const correlationId = options.correlationId ?? uuidv7Create(options.runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const ceremonyId = uuidv7Create(options.runtime)
    const created = passkeyRepositoryCreate(transaction).passkeyCeremonyCreate({
      challengeHash: passkeyChallengeHashCreate(options.challenge),
      consumedAt: null,
      createdAt: options.now,
      expiresAt: options.now + 5 * 60 * 1_000,
      id: ceremonyId,
      instanceId: options.instanceId,
      kind: "registration",
      origins: JSON.stringify(options.configuration.origins),
      purpose: options.purpose,
      rpId: options.configuration.rpId,
      sessionId: null,
      tokenHash: passkeyTokenHashCreate(options.token),
      userId: options.userId,
      userVerification: "required",
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(passkeyEventPayloadSchema, {
      ceremonyId,
      purpose: options.purpose,
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate("passkeyRegistrationStart", "The passkey event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId,
        aggregateId: ceremonyId,
        aggregateType: "passkey_ceremony",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: passkeyEventTypes.registrationStarted,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passkeys" },
        occurredAt: options.now,
        payload: payload.output,
      },
      options.runtime,
    )
    if (!event.success) return event
    return resultCreate(undefined)
  })
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
