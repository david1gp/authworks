import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { eventSecurityUnindexedEventAppend } from "../../events/server/eventSecurityUnindexedEventAppend.js"
import { mfaFactorAvailabilityResolve } from "../../mfa/actions/mfaFactorAvailabilityResolve.js"
import { mfaLoginChallengeContextGet } from "../../mfa/server/mfaLoginChallengeContextGet.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { organizationLoginContextResolve } from "../../organizations/server/organizationLoginContextResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { organizationMembershipContextValidate } from "../../organizations/server/organizationMembershipContextValidate.js"
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
  readonly mfaChallengeToken?: string
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
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The passkey timestamp is invalid.", "passkeys.invalid-timestamp")
  let organizationId: string | undefined
  let mfaChallengeId: string | undefined
  let userId = options.userId
  if (options.purpose === "mfa" && options.mfaChallengeToken !== undefined) {
    const challenge = mfaLoginChallengeContextGet({
      executor: options.database.db,
      expectedFactor: "passkey",
      expectedPurpose: "login",
      now,
      realmId: options.realmId,
      token: options.mfaChallengeToken,
    })
    if (!challenge.success) return challenge
    if (userId !== undefined && userId !== challenge.data.userId)
      return resultErrorCreate(op, "The passkey MFA challenge is invalid.", "passkeys.unauthorized")
    userId = challenge.data.userId
    organizationId = challenge.data.organizationId
    mfaChallengeId = challenge.data.challengeId
    const available = mfaFactorAvailabilityResolve({
      executor: options.database.db,
      primaryAuthenticationMethod: challenge.data.primaryAuthenticationMethod,
      realmId: options.realmId,
      userId,
    })
    if (!available.success) return available
    if (!available.data.includes("passkey"))
      return resultErrorCreate(op, "The passkey MFA factor is unavailable.", "passkeys.not-found")
    const policy = organizationLoginPolicyResolve({
      database: options.database,
      executor: options.database.db,
      organizationId,
      realmId: options.realmId,
      runtimeAvailableFactors: available.data,
    })
    if (!policy.success) return policy
    if (!policy.data.allowedFactors.includes("passkey") || !policy.data.preferredFactorOrder.includes("passkey"))
      return resultErrorCreate(op, "The passkey MFA factor is disabled for this organization.", "passkeys.conflict")
  }
  if (options.purpose === "passwordless") {
    const loginContext = organizationLoginContextResolve({
      executor: options.database.db,
      organizationId: options.organizationId,
      realmId: options.realmId,
    })
    if (!loginContext.success)
      return resultErrorCreate(
        op,
        "The passkey login method is unavailable in this organization.",
        "passkeys.not-found",
      )
    organizationId = loginContext.data.organizationId
    const policy = organizationLoginPolicyEnforce({
      database: options.database,
      realmId: options.realmId,
      method: "passkey",
      organizationId,
    })
    if (!policy.success)
      return resultErrorCreate(op, "The passkey login method is disabled for this organization.", "passkeys.conflict")
  }
  const configuration = passkeyConfigurationValidate(options.rpId, options.origins, options.rpName)
  if (!configuration.success) return configuration
  if (options.purpose === "passwordless" && (options.userId !== undefined || options.sessionId !== undefined))
    return resultErrorCreate(op, "The passwordless passkey request is invalid.", "passkeys.invalid")
  if (
    options.purpose !== "passwordless" &&
    !(options.purpose === "mfa" && mfaChallengeId !== undefined) &&
    (userId === undefined || options.sessionId === undefined)
  )
    return resultErrorCreate(op, "The passkey session is required.", "passkeys.unauthorized")
  let credentials: PasskeyCredentialRow[] = []
  const repository = passkeyRepositoryCreate(options.database.db)
  if (userId === undefined) {
    credentials = []
  } else {
    const found = repository.passkeyCredentialList(options.realmId, userId)
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
          eq(sessionTable.userId, userId),
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
    const loginContext = organizationLoginContextValidate({
      context: {
        ...(session.organizationId === null ? {} : { organizationId: session.organizationId }),
        realmId: session.realmId,
      },
      executor: options.database.db,
      ...(options.organizationId === undefined ? {} : { expectedOrganizationId: options.organizationId }),
      expectedRealmId: options.realmId,
    })
    if (!loginContext.success) return resultErrorCreate(op, "The passkey session is invalid.", "passkeys.invalid")
    organizationId = loginContext.data.organizationId
    if (options.purpose === "step_up" && organizationId !== undefined) {
      const membership = organizationMembershipContextValidate({
        executor: options.database.db,
        organizationId,
        realmId: options.realmId,
        userId,
      })
      if (!membership.success) return resultErrorCreate(op, "The passkey session is invalid.", "passkeys.unauthorized")
    }
    if (options.purpose === "step_up") {
      if (session.impersonatorId !== null)
        return resultErrorCreate(op, "The impersonated session cannot be stepped up.", "passkeys.unauthorized")
      if (session.authenticationMethod === "passkey")
        return resultErrorCreate(
          op,
          "The passkey factor must be distinct from the primary authentication method.",
          "passkeys.conflict",
        )
      const policy = organizationLoginPolicyResolve({
        database: options.database,
        executor: options.database.db,
        organizationId,
        realmId: options.realmId,
        runtimeAvailableFactors: ["passkey"],
      })
      if (!policy.success) return policy
      if (!policy.data.allowedFactors.includes("passkey") || !policy.data.preferredFactorOrder.includes("passkey"))
        return resultErrorCreate(
          op,
          "The passkey step-up factor is disabled for this organization.",
          "passkeys.conflict",
        )
    }
    credentials = found.data.filter((credential) => credential.revokedAt === null)
  }
  const token = Buffer.from(runtime.randomBytes(32)).toString("base64url")
  const challenge = Buffer.from(runtime.randomBytes(32)).toString("base64url")
  let generated: Awaited<ReturnType<typeof generateAuthenticationOptions>>
  try {
    generated = await generateAuthenticationOptions({
      allowCredentials:
        userId === undefined
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
    organizationId,
    purpose: options.purpose,
    runtime,
    sessionId: options.sessionId,
    mfaChallengeId,
    token,
    userId,
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
  readonly mfaChallengeId?: string
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
      mfaChallengeId: options.mfaChallengeId ?? null,
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
    const eventInput = {
      actorId: options.actorId ?? options.userId ?? null,
      aggregateId: ceremonyId,
      aggregateType: "passkey_ceremony" as const,
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId,
      eventType: passkeyEventTypes.authenticationStarted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passkeys" },
      occurredAt: options.now,
      payload: payload.output,
    }
    const event =
      options.userId === undefined
        ? eventSecurityUnindexedEventAppend(
            transaction,
            { ...eventInput, unindexedReason: "anonymous_passkey_authentication" },
            options.runtime,
          )
        : eventSecurityEventAppend(transaction, { ...eventInput, userSubjectId: options.userId }, options.runtime)
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
