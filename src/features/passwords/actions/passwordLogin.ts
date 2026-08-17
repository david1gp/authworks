import { scryptSync } from "node:crypto"
import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userTable } from "../../users/persistence/userTable.js"
import { passwordHashVerify } from "../domain/passwordHashVerify.js"
import { passwordIdentifierNormalize } from "../domain/passwordIdentifierNormalize.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordPolicyViewCreate } from "../domain/passwordPolicyViewCreate.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordLockoutEventPayloadSchema } from "../events/passwordLockoutEventPayloadSchema.js"
import { passwordLoginEventPayloadSchema } from "../events/passwordLoginEventPayloadSchema.js"
import { passwordLoginSucceededEventPayloadSchema } from "../events/passwordLoginSucceededEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import { type PasswordLoginRequest, passwordLoginRequestSchema } from "../public/passwordLoginRequestSchema.js"
import type { PasswordLoginResponse } from "../public/passwordLoginResponseSchema.js"
import type { PasswordSessionCreate } from "../public/passwordSessionCreate.js"

type PasswordLoginOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordLoginRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly sessionCreate?: PasswordSessionCreate
}

const passwordDummyHash = passwordDummyHashCreate()

export function passwordLogin(options: PasswordLoginOptions): Result<PasswordLoginResponse> {
  const op = "passwordLogin"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The login is not available in this tenant context.")
  const parsed = v.safeParse(passwordLoginRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The credentials are invalid.")
  const identifier = passwordIdentifierNormalize(parsed.output.identifier)
  if (!identifier.success) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.")
  }
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return resultErrorCreate(op, "The credentials are invalid.")
  if (instance.data.instance.status !== "active") {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.")
  }
  const repository = passwordRepositoryCreate(options.database.db)
  const user = repository.passwordUserFindByIdentifier(options.instanceId, identifier.data)
  if (!user.success) return resultErrorCreate(op, "The credentials are invalid.")
  if (user.data === null) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.")
  }
  const userRow = user.data
  const credential = repository.passwordCredentialGet(options.instanceId, userRow.id)
  if (!credential.success) {
    passwordHashVerify(parsed.output.password, passwordDummyHash)
    return resultErrorCreate(op, "The credentials are invalid.")
  }
  const verified = passwordHashVerify(parsed.output.password, credential.data?.hash ?? passwordDummyHash)
  if (!verified.success || !verified.data) return passwordLoginFailureRecord(options, userRow.id, "invalid_credentials")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The login timestamp is invalid.")
  const policyRow = repository.passwordPolicyGet(options.instanceId)
  if (!policyRow.success) return resultErrorCreate(op, "The credentials are invalid.")
  const policy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const authenticated = storageTransactionRun(options.database, (transaction) => {
    const currentRepository = passwordRepositoryCreate(transaction)
    const current = currentRepository.passwordUserGet(options.instanceId, userRow.id)
    if (!current.success || current.data === null) return resultErrorCreate(op, "The credentials are invalid.")
    const currentCredential = currentRepository.passwordCredentialGet(options.instanceId, current.data.id)
    if (!currentCredential.success || currentCredential.data === null)
      return resultErrorCreate(op, "The credentials are invalid.")
    const currentVerified = passwordHashVerify(parsed.output.password, currentCredential.data.hash)
    if (!currentVerified.success || !currentVerified.data) return resultErrorCreate(op, "The credentials are invalid.")
    const currentLockout = currentRepository.passwordLockoutGet(options.instanceId, current.data.id)
    if (!currentLockout.success) return resultErrorCreate(op, "The credentials are invalid.")
    const lockedUntil = currentLockout.data?.lockedUntil
    if (current.data.state === "locked" && (lockedUntil === null || lockedUntil === undefined || lockedUntil > now))
      return resultErrorCreate(op, "The credentials are invalid.")
    let userVersion = current.data.version
    if (current.data.state === "locked") {
      const unlocked = transaction
        .update(userTable)
        .set({ state: "active", updatedAt: now, version: current.data.version + 1 })
        .where(and(eq(userTable.id, current.data.id), eq(userTable.instanceId, options.instanceId)))
        .returning()
        .get()
      if (unlocked === undefined) return resultErrorCreate(op, "The credentials are invalid.")
      userVersion = unlocked.version
      const unlockedPayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!unlockedPayload.success) return resultErrorCreate(op, "The unlock event payload is invalid.")
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
          instanceId: options.instanceId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: unlockedPayload.output,
        },
        runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
    }
    if (current.data.state !== "active" && current.data.state !== "locked")
      return resultErrorCreate(op, "The credentials are invalid.")
    if (current.data.emailVerifiedAt === null) return resultErrorCreate(op, "The credentials are invalid.")
    const lockoutVersion = (currentLockout.data?.version ?? 0) + 1
    const lockout = currentRepository.passwordLockoutSet({
      failedAttempts: 0,
      instanceId: options.instanceId,
      lockedUntil: null,
      updatedAt: now,
      userId: current.data.id,
      version: lockoutVersion,
    })
    if (!lockout.success) return lockout
    const eventVersion = currentRepository.passwordEventVersionGet(options.instanceId, current.data.id)
    if (!eventVersion.success) return resultErrorCreate(op, "The credentials are invalid.")
    const payload = v.safeParse(passwordLoginSucceededEventPayloadSchema, { authenticated: true })
    if (!payload.success) return resultErrorCreate(op, "The login event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: current.data.id,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: userVersion === current.data.version ? 0 : 1,
        correlationId,
        eventType: passwordEventTypes.loginSucceeded,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      authentication: {
        authenticatedAt: now,
        instanceId: options.instanceId,
        userId: current.data.id,
      },
    })
  })
  if (!authenticated.success) return authenticated
  if (options.sessionCreate !== undefined) {
    try {
      const session = options.sessionCreate(authenticated.data.authentication)
      if (!session.success) return resultErrorCreate(op, "The authenticated session could not be created.")
    } catch (_error) {
      return resultErrorCreate(op, "The authenticated session could not be created.")
    }
  }
  return authenticated
}

function passwordLoginFailureRecord(
  options: PasswordLoginOptions,
  userId: string,
  reason: "invalid_credentials" | "locked" | "not_verified" | "inactive",
): Result<PasswordLoginResponse> {
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate("passwordLogin", "The credentials are invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const policyRow = passwordRepositoryCreate(options.database.db).passwordPolicyGet(options.instanceId)
  if (!policyRow.success) return resultErrorCreate("passwordLogin", "The credentials are invalid.")
  const policy = policyRow.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(policyRow.data)
  const recorded = storageTransactionRun(options.database, (transaction) => {
    const repository = passwordRepositoryCreate(transaction)
    const current = repository.passwordUserGet(options.instanceId, userId)
    if (!current.success || current.data === null)
      return resultErrorCreate("passwordLogin", "The credentials are invalid.")
    const currentLockout = repository.passwordLockoutGet(options.instanceId, userId)
    if (!currentLockout.success) return resultErrorCreate("passwordLogin", "The credentials are invalid.")
    if (
      currentLockout.data?.lockedUntil !== null &&
      currentLockout.data?.lockedUntil !== undefined &&
      currentLockout.data.lockedUntil > now
    )
      return resultErrorCreate("passwordLogin", "The credentials are invalid.")
    if (current.data.state !== "active" && current.data.state !== "locked")
      return resultErrorCreate("passwordLogin", "The credentials are invalid.")
    if (current.data.emailVerifiedAt === null) return resultErrorCreate("passwordLogin", "The credentials are invalid.")
    let userVersion = current.data.version
    if (current.data.state === "locked") {
      const existingUntil = currentLockout.data?.lockedUntil
      if (existingUntil === null || existingUntil === undefined || existingUntil > now)
        return resultErrorCreate("passwordLogin", "The credentials are invalid.")
      const unlocked = transaction
        .update(userTable)
        .set({ state: "active", updatedAt: now, version: current.data.version + 1 })
        .where(and(eq(userTable.id, current.data.id), eq(userTable.instanceId, options.instanceId)))
        .returning()
        .get()
      if (unlocked === undefined) return resultErrorCreate("passwordLogin", "The credentials are invalid.")
      userVersion = unlocked.version
      const unlockedPayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!unlockedPayload.success) return resultErrorCreate("passwordLogin", "The unlock event payload is invalid.")
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
          instanceId: options.instanceId,
          metadata: { auditSafe: true, source: "passwords" },
          occurredAt: now,
          payload: unlockedPayload.output,
        },
        runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
    }
    const attempts = (currentLockout.data?.failedAttempts ?? 0) + 1
    const locked = attempts >= policy.maximumAttempts
    const lockoutVersion = (currentLockout.data?.version ?? 0) + 1
    const lockout = repository.passwordLockoutSet({
      failedAttempts: attempts,
      instanceId: options.instanceId,
      lockedUntil: locked ? now + policy.lockoutDurationMs : null,
      updatedAt: now,
      userId,
      version: lockoutVersion,
    })
    if (!lockout.success) return lockout
    const eventVersion = repository.passwordEventVersionGet(options.instanceId, userId)
    if (!eventVersion.success) return resultErrorCreate("passwordLogin", "The credentials are invalid.")
    if (locked) {
      const updated = transaction
        .update(userTable)
        .set({ state: "locked", updatedAt: now, version: userVersion + 1 })
        .where(and(eq(userTable.id, userId), eq(userTable.instanceId, options.instanceId)))
        .returning()
        .get()
      if (updated === undefined) return resultErrorCreate("passwordLogin", "The credentials are invalid.")
      const statePayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "active", to: "locked" })
      if (!statePayload.success) return resultErrorCreate("passwordLogin", "The lock event payload is invalid.")
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
          instanceId: options.instanceId,
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
      return resultErrorCreate("passwordLogin", "The login event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: userId,
        aggregateType: "password",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: locked ? 2 : userVersion === current.data.version ? 0 : 1,
        correlationId,
        eventType: locked ? passwordEventTypes.locked : passwordEventTypes.loginFailed,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: locked ? lockoutPayload.output : payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate(undefined)
  })
  if (!recorded.success) return recorded
  return resultErrorCreate("passwordLogin", "The credentials are invalid.")
}

function passwordDummyHashCreate(): string {
  const salt = Buffer.alloc(16)
  const hash = Buffer.from(
    scryptSync("password-dummy-value", salt, 32, { maxmem: 32 * 1024 * 1024, N: 16_384, p: 1, r: 8 }),
  )
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`
}
