import { scryptSync } from "node:crypto"
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
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { mfaPrimaryAuthenticationComplete } from "../../mfa/actions/mfaPrimaryAuthenticationComplete.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { organizationLoginContextResolve } from "../../organizations/server/organizationLoginContextResolve.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
import { type UserRow, userTable } from "../../users/persistence/userTable.js"
import { passwordHashVerify } from "../domain/passwordHashVerify.js"
import { passwordIdentifierNormalize } from "../domain/passwordIdentifierNormalize.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordPolicyViewCreate } from "../domain/passwordPolicyViewCreate.js"
import type { PasswordSessionCreate } from "../domain/passwordSessionCreate.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordLockoutEventPayloadSchema } from "../events/passwordLockoutEventPayloadSchema.js"
import { passwordLoginEventPayloadSchema } from "../events/passwordLoginEventPayloadSchema.js"
import { passwordLoginSucceededEventPayloadSchema } from "../events/passwordLoginSucceededEventPayloadSchema.js"
import { passwordUnlockedEventPayloadSchema } from "../events/passwordUnlockedEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import { type PasswordLoginRequest, passwordLoginRequestSchema } from "../public/passwordLoginRequestSchema.js"
import type { PasswordLoginResponse } from "../public/passwordLoginResponseSchema.js"

type PasswordLoginOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordLoginRequest
  readonly realmId: string
  readonly organizationId?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly sessionCreate?: PasswordSessionCreate
}

const passwordDummyHash = passwordDummyHashCreate()

export function passwordLogin(options: PasswordLoginOptions): Result<PasswordLoginResponse> {
  const op = "passwordLogin"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The login is not available in this tenant context.", "passwords.tenant-mismatch")
  const parsed = v.safeParse(passwordLoginRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  const identifier = passwordIdentifierNormalize(parsed.output.identifier)
  if (!identifier.success) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  }
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  if (realm.data.realm.status !== "active") {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  }
  if (
    options.organizationId !== undefined &&
    parsed.output.organizationId !== undefined &&
    options.organizationId !== parsed.output.organizationId
  ) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  }
  const loginContext = organizationLoginContextResolve({
    executor: options.database.db,
    organizationId: options.organizationId ?? parsed.output.organizationId,
    realmId: options.realmId,
  })
  if (!loginContext.success) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  }
  const organizationId = loginContext.data.organizationId
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    realmId: options.realmId,
    method: "password",
    organizationId,
  })
  if (!policy.success) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  }
  const repository = passwordRepositoryCreate(options.database.db)
  const user = repository.passwordUserFindByVerifiedIdentifier(options.realmId, identifier.data)
  if (!user.success) return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  if (user.data === null) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  }
  const userRow = user.data
  const credential = repository.passwordCredentialGet(options.realmId, userRow.id)
  if (!credential.success) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  }
  const verified = passwordHashVerify(parsed.output.password, credential.data?.hash ?? passwordDummyHash)
  if (!verified.success || !verified.data) return passwordLoginFailureRecord(options, userRow.id, "invalid_credentials")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The login timestamp is invalid.", "passwords.invalid-timestamp")
  const policyRow = repository.passwordPolicyGet(options.realmId)
  if (!policyRow.success) return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
  const passwordPolicy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const authenticated = storageTransactionRun(options.database, (transaction) => {
    const currentRepository = passwordRepositoryCreate(transaction)
    const current = currentRepository.passwordUserGet(options.realmId, userRow.id)
    if (!current.success || current.data === null)
      return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    const currentUser = current.data
    const currentCredential = currentRepository.passwordCredentialGet(options.realmId, current.data.id)
    if (!currentCredential.success || currentCredential.data === null)
      return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    const currentVerified = passwordHashVerify(parsed.output.password, currentCredential.data.hash)
    if (!currentVerified.success || !currentVerified.data)
      return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    const currentLockout = currentRepository.passwordLockoutGet(options.realmId, current.data.id)
    if (!currentLockout.success) return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    const lockedUntil = currentLockout.data?.lockedUntil
    if (current.data.state === "locked" && (lockedUntil === null || lockedUntil === undefined || lockedUntil > now))
      return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    let userVersion = current.data.version
    let userUnlocked = false
    if (current.data.state === "locked") {
      const unlocked = transaction
        .update(userTable)
        .set({ state: "active", updatedAt: now, version: current.data.version + 1 })
        .where(and(eq(userTable.id, current.data.id), eq(userTable.realmId, options.realmId)))
        .returning()
        .get()
      if (unlocked === undefined) return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
      userVersion = unlocked.version
      const unlockedPayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!unlockedPayload.success)
        return resultErrorCreate(op, "The unlock event payload is invalid.", "passwords.event-invalid")
      const unlockedEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: current.data.id,
          aggregateType: "user",
          aggregateVersion: userVersion,
          commandIndex: 0,
          correlationId,
          eventType: userEventTypes.stateChanged,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: unlockedPayload.output,
        },
        runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
      userUnlocked = true
    }
    if (current.data.state !== "active" && current.data.state !== "locked")
      return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    if (!passwordLoginRegistrationVerified(current.data))
      return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    const lockoutVersion = (currentLockout.data?.version ?? 0) + 1
    const lockout = currentRepository.passwordLockoutSet({
      failedAttempts: 0,
      realmId: options.realmId,
      lockedUntil: null,
      updatedAt: now,
      userId: currentUser.id,
      version: lockoutVersion,
    })
    if (!lockout.success) return lockout
    const eventVersion = currentRepository.passwordEventVersionGet(options.realmId, current.data.id)
    if (!eventVersion.success) return resultErrorCreate(op, "The credentials are invalid.", "passwords.unauthorized")
    if (userUnlocked) {
      const unlockedPayload = v.safeParse(passwordUnlockedEventPayloadSchema, { unlockedAt: now })
      if (!unlockedPayload.success)
        return resultErrorCreate(op, "The unlock event payload is invalid.", "passwords.event-invalid")
      const unlockedEvent = eventSecurityEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: current.data.id,
          aggregateType: "password",
          aggregateVersion: eventVersion.data + 1,
          commandIndex: 0,
          correlationId,
          eventType: passwordEventTypes.unlocked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: unlockedPayload.output,
          userSubjectId: current.data.id,
        },
        runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
    }
    const payload = v.safeParse(passwordLoginSucceededEventPayloadSchema, { authenticated: true })
    if (!payload.success) return resultErrorCreate(op, "The login event payload is invalid.", "passwords.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: current.data.id,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + (userUnlocked ? 2 : 1),
        commandIndex: userUnlocked ? 1 : 0,
        correlationId,
        eventType: passwordEventTypes.loginSucceeded,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: current.data.id,
      },
      runtime,
    )
    if (!event.success) return event
    const authentication = {
      authenticatedAt: now,
      realmId: options.realmId,
      userId: currentUser.id,
    }
    const authenticationResult = mfaPrimaryAuthenticationComplete({
      actorId: options.context.actorId,
      deviceMetadata: options.deviceMetadata,
      executor: transaction,
      organizationId,
      policyDatabase: options.database,
      realmId: options.realmId,
      primaryAuthenticationMethod: "password",
      runtime,
      sessionCreate:
        options.sessionCreate === undefined
          ? undefined
          : () =>
              options.sessionCreate!(
                {
                  authenticatedAt: now,
                  realmId: options.realmId,
                  userId: currentUser.id,
                },
                {
                  actorId: options.context.actorId,
                  commandIndex: userVersion === currentUser.version ? 1 : 2,
                  correlationId,
                  database: options.database,
                  deviceMetadata: options.deviceMetadata,
                  executor: transaction,
                  organizationId,
                  runtime,
                },
              ),
      userId: currentUser.id,
    })
    if (!authenticationResult.success) return authenticationResult
    return resultCreate({ authentication, ...authenticationResult.data })
  })
  if (!authenticated.success) return authenticated
  return authenticated
}

function passwordLoginFailureRecord(
  options: PasswordLoginOptions,
  userId: string,
  reason: "invalid_credentials" | "locked" | "not_verified" | "inactive",
): Result<PasswordLoginResponse> {
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const policyRow = passwordRepositoryCreate(options.database.db).passwordPolicyGet(options.realmId)
  if (!policyRow.success)
    return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
  const policy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const recorded = storageTransactionRun(options.database, (transaction) => {
    const repository = passwordRepositoryCreate(transaction)
    const current = repository.passwordUserGet(options.realmId, userId)
    if (!current.success || current.data === null)
      return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
    const currentLockout = repository.passwordLockoutGet(options.realmId, userId)
    if (!currentLockout.success)
      return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
    if (
      currentLockout.data?.lockedUntil !== null &&
      currentLockout.data?.lockedUntil !== undefined &&
      currentLockout.data.lockedUntil > now
    )
      return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
    if (current.data.state !== "active" && current.data.state !== "locked")
      return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
    if (!passwordLoginRegistrationVerified(current.data))
      return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
    let userVersion = current.data.version
    let userUnlocked = false
    if (current.data.state === "locked") {
      const existingUntil = currentLockout.data?.lockedUntil
      if (existingUntil === null || existingUntil === undefined || existingUntil > now)
        return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
      const unlocked = transaction
        .update(userTable)
        .set({ state: "active", updatedAt: now, version: current.data.version + 1 })
        .where(and(eq(userTable.id, current.data.id), eq(userTable.realmId, options.realmId)))
        .returning()
        .get()
      if (unlocked === undefined)
        return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
      userVersion = unlocked.version
      const unlockedPayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!unlockedPayload.success)
        return resultErrorCreate("passwordLogin", "The unlock event payload is invalid.", "passwords.event-invalid")
      const unlockedEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: current.data.id,
          aggregateType: "user",
          aggregateVersion: userVersion,
          commandIndex: 0,
          correlationId,
          eventType: userEventTypes.stateChanged,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: unlockedPayload.output,
        },
        runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
      userUnlocked = true
    }
    const attempts = (currentLockout.data?.failedAttempts ?? 0) + 1
    const locked = attempts >= policy.maximumAttempts
    const lockoutVersion = (currentLockout.data?.version ?? 0) + 1
    const lockout = repository.passwordLockoutSet({
      failedAttempts: attempts,
      realmId: options.realmId,
      lockedUntil: locked ? now + policy.lockoutDurationMs : null,
      updatedAt: now,
      userId,
      version: lockoutVersion,
    })
    if (!lockout.success) return lockout
    const eventVersion = repository.passwordEventVersionGet(options.realmId, userId)
    if (!eventVersion.success)
      return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
    if (userUnlocked) {
      const unlockedPayload = v.safeParse(passwordUnlockedEventPayloadSchema, { unlockedAt: now })
      if (!unlockedPayload.success)
        return resultErrorCreate("passwordLogin", "The unlock event payload is invalid.", "passwords.event-invalid")
      const unlockedEvent = eventSecurityEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: userId,
          aggregateType: "password",
          aggregateVersion: eventVersion.data + 1,
          commandIndex: 0,
          correlationId,
          eventType: passwordEventTypes.unlocked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: unlockedPayload.output,
          userSubjectId: userId,
        },
        runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
    }
    if (locked) {
      const updated = transaction
        .update(userTable)
        .set({ state: "locked", updatedAt: now, version: userVersion + 1 })
        .where(and(eq(userTable.id, userId), eq(userTable.realmId, options.realmId)))
        .returning()
        .get()
      if (updated === undefined)
        return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
      const statePayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "active", to: "locked" })
      if (!statePayload.success)
        return resultErrorCreate("passwordLogin", "The lock event payload is invalid.", "passwords.event-invalid")
      const stateEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: userId,
          aggregateType: "user",
          aggregateVersion: updated.version,
          commandIndex: 1,
          correlationId,
          eventType: userEventTypes.stateChanged,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: statePayload.output,
        },
        runtime,
      )
      if (!stateEvent.success) return stateEvent
    }
    const payload = v.safeParse(passwordLoginEventPayloadSchema, { reason })
    const lockoutPayload = v.safeParse(passwordLockoutEventPayloadSchema, {
      attempts,
      lockedUntil: now + policy.lockoutDurationMs,
    })
    if (!payload.success || !lockoutPayload.success)
      return resultErrorCreate("passwordLogin", "The login event payload is invalid.", "passwords.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: userId,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + (userUnlocked ? 2 : 1),
        commandIndex: userUnlocked ? 1 : 0,
        correlationId,
        eventType: locked ? passwordEventTypes.locked : passwordEventTypes.loginFailed,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: locked ? lockoutPayload.output : payload.output,
        userSubjectId: userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate(undefined)
  })
  if (!recorded.success) return recorded
  return resultErrorCreate("passwordLogin", "The credentials are invalid.", "passwords.unauthorized")
}

function passwordDummyHashCreate(): string {
  const salt = Buffer.alloc(16)
  const hash = Buffer.from(
    scryptSync("password-dummy-value", salt, 32, { maxmem: 32 * 1024 * 1024, N: 16_384, p: 1, r: 8 }),
  )
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`
}

function passwordLoginRegistrationVerified(user: UserRow): boolean {
  if (user.registrationVerifiedAt === null || user.registrationVerificationMethod === null) return false
  if (user.registrationVerificationMethod === "email") return true
  if (user.registrationVerificationMethod === "whatsapp") return user.phoneNumberVerifiedAt !== null
  return false
}
