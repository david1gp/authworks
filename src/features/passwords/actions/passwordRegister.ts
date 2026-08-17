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
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userNameNormalize } from "../../users/domain/userNameNormalize.js"
import { userProfileNormalize } from "../../users/domain/userProfileNormalize.js"
import { userCreatedEventPayloadSchema } from "../../users/events/userCreatedEventPayloadSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userProfileTable } from "../../users/persistence/userProfileTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { passwordPolicyCheck } from "../domain/passwordPolicyCheck.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordHashCreate } from "../domain/passwordHashCreate.js"
import { passwordTokenCreate } from "../domain/passwordTokenCreate.js"
import { passwordTokenHashCreate } from "../domain/passwordTokenHashCreate.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordCredentialChangedEventPayloadSchema } from "../events/passwordCredentialChangedEventPayloadSchema.js"
import { passwordRegistrationEventPayloadSchema } from "../events/passwordRegistrationEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordRegistrationDelivery } from "../public/passwordRegistrationDeliverySchema.js"
import {
  type PasswordRegistrationRequest,
  passwordRegistrationRequestSchema,
} from "../public/passwordRegistrationRequestSchema.js"
import type { PasswordRegistrationResponse } from "../public/passwordRegistrationResponseSchema.js"
import { organizationLoginPolicyEnforce } from "../../organizations/public/organizationLoginPolicyEnforce.js"

type PasswordRegisterOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordRegistrationRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly onVerificationToken?: (delivery: PasswordRegistrationDelivery) => void
}

export function passwordRegister(options: PasswordRegisterOptions): Result<PasswordRegistrationResponse> {
  const op = "passwordRegister"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The registration is not available in this tenant context.")
  const parsed = v.safeParse(passwordRegistrationRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The registration request is invalid.")
  const email = userEmailNormalize(parsed.output.email)
  if (!email.success) return resultErrorCreate(op, "The registration request is invalid.")
  const userName = userNameNormalize(parsed.output.userName)
  if (!userName.success) return resultErrorCreate(op, "The registration request is invalid.")
  const profile = userProfileNormalize(parsed.output.profile)
  if (!profile.success) return resultErrorCreate(op, "The registration request is invalid.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const loginPolicy = organizationLoginPolicyEnforce({
    database: options.database,
    instanceId: options.instanceId,
    method: "password",
    organizationId: parsed.output.organizationId,
  })
  if (!loginPolicy.success) return resultErrorCreate(op, "Password registration is disabled for this organization.")
  const policyRow = passwordRepositoryCreate(options.database.db).passwordPolicyGet(options.instanceId)
  if (!policyRow.success) return policyRow
  const policy =
    policyRow.data === null
      ? passwordPolicyDefaults
      : {
          lockoutDurationMs: policyRow.data.lockoutDurationMs,
          maximumAttempts: policyRow.data.maximumAttempts,
          minimumLength: policyRow.data.minimumLength,
          requireLowercase: policyRow.data.requireLowercase === 1,
          requireNumber: policyRow.data.requireNumber === 1,
          requireSymbol: policyRow.data.requireSymbol === 1,
          requireUppercase: policyRow.data.requireUppercase === 1,
        }
  const checked = passwordPolicyCheck(parsed.output.password, policy)
  if (!checked.success) return checked
  const hash = passwordHashCreate(parsed.output.password, options.runtime ?? options.database.runtime)
  if (!hash.success) return hash
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The registration timestamp is invalid.")
  const userId = uuidv7Create(runtime)
  const challengeId = uuidv7Create(runtime)
  const token = passwordTokenCreate(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const existing = passwordRepositoryCreate(options.database.db).passwordUserFindByIdentifier(
    options.instanceId,
    email.data,
  )
  if (!existing.success) return existing
  if (existing.data !== null) return resultCreate({ accepted: true, verificationRequired: true })
  const existingName = passwordRepositoryCreate(options.database.db).passwordUserFindByIdentifier(
    options.instanceId,
    userName.data,
  )
  if (!existingName.success) return existingName
  if (existingName.data !== null) return resultCreate({ accepted: true, verificationRequired: true })

  const created = storageTransactionRun(options.database, (transaction) => {
    const user = transaction
      .insert(userTable)
      .values({
        createdAt: now,
        deletedAt: null,
        email: email.data,
        emailVerifiedAt: null,
        id: userId,
        instanceId: options.instanceId,
        state: "initial",
        updatedAt: now,
        userName: userName.data,
        version: 1,
      })
      .returning()
      .get()
    if (user === undefined) return resultErrorCreate(op, "The registration could not be completed.")
    const createdProfile = transaction
      .insert(userProfileTable)
      .values({
        displayName: profile.data.displayName,
        firstName: profile.data.firstName,
        gender: profile.data.gender,
        instanceId: options.instanceId,
        lastName: profile.data.lastName,
        nickName: profile.data.nickName,
        preferredLanguage: profile.data.preferredLanguage,
        updatedAt: now,
        userId,
      })
      .returning()
      .get()
    if (createdProfile === undefined) return resultErrorCreate(op, "The registration could not be completed.")
    const repository = passwordRepositoryCreate(transaction)
    const credential = repository.passwordCredentialCreate({
      changedAt: now,
      createdAt: now,
      hash: hash.data,
      instanceId: options.instanceId,
      userId,
      version: 1,
    })
    if (!credential.success) return credential
    const challenge = repository.passwordChallengeCreate({
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1_000,
      id: challengeId,
      instanceId: options.instanceId,
      kind: "verification",
      tokenHash: passwordTokenHashCreate(token.valueGet()),
      userId,
      version: 1,
    })
    if (!challenge.success) return challenge
    const userPayload = v.safeParse(userCreatedEventPayloadSchema, { emailVerified: false, state: "initial" })
    if (!userPayload.success) return resultErrorCreate(op, "The registration event payload is invalid.")
    const userEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: userId,
        aggregateType: "user",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.created,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: userPayload.output,
      },
      runtime,
    )
    if (!userEvent.success) return userEvent
    const credentialPayload = v.safeParse(passwordCredentialChangedEventPayloadSchema, { reason: "registration" })
    if (!credentialPayload.success) return resultErrorCreate(op, "The password event payload is invalid.")
    const credentialEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: userId,
        aggregateType: "password",
        aggregateVersion: 1,
        commandIndex: 1,
        correlationId,
        eventType: passwordEventTypes.credentialChanged,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: credentialPayload.output,
      },
      runtime,
    )
    if (!credentialEvent.success) return credentialEvent
    const requestedPayload = v.safeParse(passwordRegistrationEventPayloadSchema, { verificationRequired: true })
    if (!requestedPayload.success) return resultErrorCreate(op, "The verification event payload is invalid.")
    const requestedEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: userId,
        aggregateType: "password",
        aggregateVersion: 2,
        commandIndex: 2,
        correlationId,
        eventType: passwordEventTypes.emailVerificationRequested,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: now,
        payload: requestedPayload.output,
      },
      runtime,
    )
    if (!requestedEvent.success) return requestedEvent
    return resultCreate(undefined)
  })
  if (!created.success) return created
  try {
    options.onVerificationToken?.({ instanceId: options.instanceId, token: token.valueGet(), userId })
  } catch (_error) {}
  return resultCreate({ accepted: true, verificationRequired: true })
}
