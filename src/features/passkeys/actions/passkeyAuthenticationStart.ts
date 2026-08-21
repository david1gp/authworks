import { generateAuthenticationOptions } from "@simplewebauthn/server"
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
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import { passkeyChallengeHashCreate } from "../domain/passkeyChallengeHashCreate.js"
import { passkeyConfigurationValidate } from "../domain/passkeyConfigurationValidate.js"
import { passkeyTokenHashCreate } from "../domain/passkeyTokenHashCreate.js"
import { passkeyEventPayloadSchema } from "../events/passkeyEventPayloadSchema.js"
import { passkeyEventTypes } from "../events/passkeyEventTypes.js"
import type { PasskeyCredentialRow } from "../persistence/passkeyCredentialTable.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyAuthenticationStartResponse } from "../public/passkeyAuthenticationStartResponseSchema.js"
import { passkeyAuthenticationStartResponseSchema } from "../public/passkeyAuthenticationStartResponseSchema.js"
import type { PasskeyCeremonyPurpose } from "../public/passkeyCeremonyPurposeSchema.js"

type PasskeyAuthenticationStartOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly origins: readonly string[]
  readonly rpId: string
  readonly rpName: string
  readonly purpose: PasskeyCeremonyPurpose
  readonly organizationId?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId?: string
  readonly sessionId?: string
  readonly actorId?: string | null
  readonly correlationId?: string
}

export async function passkeyAuthenticationStart(
  options: PasskeyAuthenticationStartOptions,
): Promise<Result<PasskeyAuthenticationStartResponse>> {
  const op = "passkeyAuthenticationStart"
  if (options.purpose === "passwordless") {
    const policy = organizationLoginPolicyEnforce({
      database: options.database,
      realmId: options.realmId,
      method: "passkey",
      organizationId: options.organizationId,
    })
    if (!policy.success)
      return resultErrorCreate(op, "The passkey login method is disabled for this organization.", "passkeys.conflict")
  }
  const configuration = passkeyConfigurationValidate(options.rpId, options.origins, options.rpName)
  if (!configuration.success) return configuration
  if (options.purpose === "passwordless" && (options.userId !== undefined || options.sessionId !== undefined))
    return resultErrorCreate(op, "The passwordless passkey request is invalid.", "passkeys.invalid")
  if (options.purpose !== "passwordless" && (options.userId === undefined || options.sessionId === undefined))
    return resultErrorCreate(op, "The passkey session is required.", "passkeys.unauthorized")
  let credentials: PasskeyCredentialRow[] = []
  const repository = passkeyRepositoryCreate(options.database.db)
  if (options.userId === undefined) {
    credentials = []
  } else {
    const found = repository.passkeyCredentialList(options.realmId, options.userId)
    if (!found.success) return found
    if (found.data.every((credential) => credential.revokedAt !== null))
      return resultErrorCreate(op, "An active passkey credential is required.", "passkeys.unauthorized")
    const session = options.database.db
      .select()
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.realmId, options.realmId),
          eq(sessionTable.id, options.sessionId!),
          eq(sessionTable.userId, options.userId),
        ),
      )
      .get()
    if (
      session === undefined ||
      session.revokedAt !== null ||
      session.expiresAt <= (options.runtime ?? options.database.runtime).now() ||
      session.assurance === "none"
    )
      return resultErrorCreate(op, "The passkey session is invalid.", "passkeys.invalid")
    credentials = found.data.filter((credential) => credential.revokedAt === null)
  }
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The passkey timestamp is invalid.", "passkeys.invalid-timestamp")
  const token = Buffer.from(runtime.randomBytes(32)).toString("base64url")
  const challenge = Buffer.from(runtime.randomBytes(32)).toString("base64url")
  let generated: Awaited<ReturnType<typeof generateAuthenticationOptions>>
  try {
    generated = await generateAuthenticationOptions({
      allowCredentials:
        options.userId === undefined
          ? undefined
          : credentials.map((credential) => ({
              id: credential.credentialId,
              transports: passkeyTransportsParse(credential.transports),
            })),
      challenge: Buffer.from(challenge, "base64url"),
      rpID: configuration.data.rpId,
      timeout: 60_000,
      userVerification: "required",
    })
  } catch (_error) {
    return resultErrorCreate(op, "The passkey authentication options could not be created.", "passkeys.write-failed")
  }
  const stored = passkeyAuthenticationStartStore({
    actorId: options.actorId,
    challenge,
    configuration: configuration.data,
    correlationId: options.correlationId,
    database: options.database,
    realmId: options.realmId,
    now,
    organizationId: options.organizationId,
    purpose: options.purpose,
    runtime,
    sessionId: options.sessionId,
    token,
    userId: options.userId,
  })
  if (!stored.success) return stored
  const response = v.safeParse(passkeyAuthenticationStartResponseSchema, { options: generated, token })
  if (!response.success)
    return resultErrorCreate(op, "The passkey authentication options are invalid.", "passkeys.invalid")
  return resultCreate(response.output)
}

type PasskeyAuthenticationStartStoreOptions = {
  readonly actorId?: string | null
  readonly challenge: string
  readonly configuration: { readonly origins: readonly string[]; readonly rpId: string; readonly rpName: string }
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly now: number
  readonly organizationId?: string
  readonly purpose: PasskeyCeremonyPurpose
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionId?: string
  readonly token: string
  readonly userId?: string
}

function passkeyAuthenticationStartStore(options: PasskeyAuthenticationStartStoreOptions): Result<void> {
  const correlationId = options.correlationId ?? uuidv7Create(options.runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const ceremonyId = uuidv7Create(options.runtime)
    const created = passkeyRepositoryCreate(transaction).passkeyCeremonyCreate({
      challengeHash: passkeyChallengeHashCreate(options.challenge),
      consumedAt: null,
      createdAt: options.now,
      expiresAt: options.now + 5 * 60 * 1_000,
      id: ceremonyId,
      realmId: options.realmId,
      kind: "authentication",
      organizationId: options.organizationId ?? null,
      origins: JSON.stringify(options.configuration.origins),
      purpose: options.purpose,
      rpId: options.configuration.rpId,
      sessionId: options.sessionId ?? null,
      tokenHash: passkeyTokenHashCreate(options.token),
      userId: options.userId ?? null,
      userVerification: "required",
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(passkeyEventPayloadSchema, {
      ceremonyId,
      purpose: options.purpose,
      ...(options.userId === undefined ? {} : { userId: options.userId }),
    })
    if (!payload.success)
      return resultErrorCreate(
        "passkeyAuthenticationStart",
        "The passkey event payload is invalid.",
        "passkeys.event-invalid",
      )
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId ?? null,
        aggregateId: ceremonyId,
        aggregateType: "passkey_ceremony",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: passkeyEventTypes.authenticationStarted,
        realmId: options.realmId,
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
