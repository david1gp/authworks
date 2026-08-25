import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { rateLimitKeyHashCreate } from "../../../platform/rateLimit/rateLimitKeyHashCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userNameNormalize } from "../../users/domain/userNameNormalize.js"
import { userPhoneNumberNormalize } from "../../users/domain/userPhoneNumberNormalize.js"
import { userProfileNormalize } from "../../users/domain/userProfileNormalize.js"
import { userCreatedEventPayloadSchema } from "../../users/events/userCreatedEventPayloadSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import type { UserProfile } from "../../users/public/userProfileSchema.js"
import { passwordHashCreate } from "../domain/passwordHashCreate.js"
import { passwordPolicyCheck } from "../domain/passwordPolicyCheck.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordRegistrationCodeCreate } from "../domain/passwordRegistrationCodeCreate.js"
import { passwordRegistrationCodeHashCreate } from "../domain/passwordRegistrationCodeHashCreate.js"
import { passwordRegistrationRateLimitSecretValidate } from "../domain/passwordRegistrationRateLimitSecretValidate.js"
import { passwordTokenCreate } from "../domain/passwordTokenCreate.js"
import { passwordTokenHashCreate } from "../domain/passwordTokenHashCreate.js"
import type { PasswordWhatsappAvailabilityPort } from "../domain/passwordWhatsappAvailabilityPort.js"
import type { PasswordWhatsappDeliveryPort } from "../domain/passwordWhatsappDeliveryPort.js"
import { passwordCredentialChangedEventPayloadSchema } from "../events/passwordCredentialChangedEventPayloadSchema.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordRegistrationEventPayloadSchema } from "../events/passwordRegistrationEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordRegistrationDelivery } from "../public/passwordRegistrationDeliverySchema.js"
import {
  type PasswordRegistrationRequest,
  passwordRegistrationRequestSchema,
} from "../public/passwordRegistrationRequestSchema.js"
import type { PasswordRegistrationResponse } from "../public/passwordRegistrationResponseSchema.js"
import type { PasswordRegistrationWhatsappDelivery } from "../public/passwordRegistrationWhatsappDeliverySchema.js"
import { passwordRegistrationRateLimitConsume } from "./passwordRegistrationRateLimitConsume.js"

const passwordRegistrationChallengeCooldownMs = 60 * 1_000
const passwordRegistrationChallengeExpiryMs = 10 * 60 * 1_000
const passwordRegistrationChallengeMaxAttempts = 5

type PasswordRegisterSharedOptions = {
  readonly clientIp?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly onVerificationToken?: (delivery: PasswordRegistrationDelivery) => void
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly whatsappDelivery?: PasswordWhatsappDeliveryPort
}

type PasswordRegisterOptions = PasswordRegisterSharedOptions &
  (
    | {
        readonly input: Omit<PasswordRegistrationRequest, "verificationMethod"> & {
          readonly verificationMethod?: "email"
        }
        readonly whatsappAvailability?: PasswordWhatsappAvailabilityPort
      }
    | {
        readonly input: Omit<PasswordRegistrationRequest, "verificationMethod"> & {
          readonly verificationMethod: "whatsapp"
        }
        readonly whatsappAvailability: PasswordWhatsappAvailabilityPort
      }
  )

type PasswordRegisterCommit =
  | { readonly duplicate: true; readonly response: PasswordRegistrationResponse }
  | { readonly rateLimited: true; readonly retryAt: number }
  | {
      readonly duplicate: false
      readonly response: PasswordRegistrationResponse
      readonly token?: string
      readonly whatsappDelivery?: PasswordRegistrationWhatsappDelivery
    }

export function passwordRegister(options: PasswordRegisterOptions): Result<PasswordRegistrationResponse> {
  const op = "passwordRegister"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The registration is not available in this tenant context.",
      "passwords.tenant-mismatch",
    )
  const parsed = v.safeParse(passwordRegistrationRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The registration request is invalid.", "passwords.invalid")
  const verificationMethod = parsed.output.verificationMethod ?? "email"
  const email = userEmailNormalize(parsed.output.email)
  if (!email.success) return resultErrorCreate(op, "The registration request is invalid.", "passwords.invalid")
  const userName = userNameNormalize(parsed.output.userName)
  if (!userName.success) return resultErrorCreate(op, "The registration request is invalid.", "passwords.invalid")
  const phoneNumber =
    verificationMethod === "whatsapp" && parsed.output.phoneNumber !== undefined
      ? userPhoneNumberNormalize(parsed.output.phoneNumber)
      : resultCreate<string | null>(null)
  if (!phoneNumber.success) return resultErrorCreate(op, "The registration request is invalid.", "passwords.invalid")
  if (verificationMethod === "whatsapp" && phoneNumber.data === null)
    return resultErrorCreate(op, "The registration request is invalid.", "passwords.invalid")
  const profile = userProfileNormalize(parsed.output.profile)
  if (!profile.success) return resultErrorCreate(op, "The registration request is invalid.", "passwords.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The realm is not active.", "passwords.invalid")
  const loginPolicy = organizationLoginPolicyEnforce({
    database: options.database,
    realmId: options.realmId,
    method: "password",
    organizationId: parsed.output.organizationId,
  })
  if (!loginPolicy.success)
    return resultErrorCreate(op, "Password registration is disabled for this organization.", "passwords.forbidden")
  if (verificationMethod === "whatsapp") {
    const whatsappPolicy = organizationLoginPolicyEnforce({
      database: options.database,
      method: "whatsapp_otp",
      organizationId: parsed.output.organizationId,
      realmId: options.realmId,
    })
    if (!whatsappPolicy.success)
      return resultErrorCreate(op, "WhatsApp registration is disabled for this organization.", "passwords.forbidden")
  }
  if (verificationMethod === "whatsapp") {
    const whatsappAvailability = options.whatsappAvailability
    if (whatsappAvailability === undefined)
      return resultErrorCreate(op, "WhatsApp registration is currently unavailable.", "passwords.whatsapp-unavailable")
    const availability = whatsappAvailability.whatsappOtpAvailabilityGet({
      organizationId: parsed.output.organizationId,
      realmId: options.realmId,
    })
    if (!availability.success)
      return resultErrorCreate(op, "WhatsApp registration is currently unavailable.", "passwords.whatsapp-unavailable")
    if (!availability.data.available)
      return resultErrorCreate(op, "WhatsApp registration is currently unavailable.", "passwords.whatsapp-unavailable")
  }
  const policyRow = passwordRepositoryCreate(options.database.db).passwordPolicyGet(options.realmId)
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
  const runtime = options.runtime ?? options.database.runtime
  const hash = passwordHashCreate(parsed.output.password, runtime)
  if (!hash.success) return hash
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The registration timestamp is invalid.", "passwords.invalid-timestamp")
  const rateLimitSecret =
    verificationMethod === "whatsapp"
      ? passwordRegistrationRateLimitSecretValidate(options.rateLimitSecret)
      : resultCreate<Secret | string | undefined>(undefined)
  if (!rateLimitSecret.success) return rateLimitSecret
  const identityHash =
    verificationMethod === "whatsapp" && rateLimitSecret.data !== undefined
      ? rateLimitKeyHashCreate(rateLimitSecret.data, `${options.realmId}:registration:identity:${phoneNumber.data}`)
      : undefined
  const userId = uuidv7Create(runtime)
  const challengeId = uuidv7Create(runtime)
  const token = verificationMethod === "email" ? passwordTokenCreate(runtime) : undefined
  const code = verificationMethod === "whatsapp" ? passwordRegistrationCodeCreate(runtime) : undefined
  if (code !== undefined && !code.success) return code
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const committed = storageTransactionRun(options.database, (transaction) =>
    passwordRegisterTransaction({
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      email: email.data,
      hash: hash.data,
      identityHash,
      method: verificationMethod,
      now,
      phoneNumber: phoneNumber.data,
      profile: profile.data,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
      token: token?.valueGet(),
      userName: userName.data,
      userId,
      code: code?.data,
      challengeId,
    }),
  )
  if (!committed.success) return committed
  if ("rateLimited" in committed.data)
    return resultErrorCreate(op, "Too many registration requests.", "passwords.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if (committed.data.duplicate) return resultCreate(committed.data.response)
  if (committed.data.token !== undefined)
    passwordVerificationTokenInvoke(options.onVerificationToken, {
      email: email.data,
      realmId: options.realmId,
      token: committed.data.token,
      userId,
    })
  if (committed.data.whatsappDelivery !== undefined && options.whatsappDelivery !== undefined)
    passwordWhatsappDeliveryInvoke(options.whatsappDelivery, committed.data.whatsappDelivery)
  return resultCreate(committed.data.response)
}

type PasswordRegisterTransactionOptions = {
  readonly challengeId: string
  readonly clientIp: string
  readonly code?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly email: string
  readonly hash: string
  readonly identityHash?: string
  readonly method: "email" | "whatsapp"
  readonly now: number
  readonly phoneNumber: string | null
  readonly profile: { readonly [K in keyof UserProfile]?: UserProfile[K] | null }
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token?: string
  readonly userName: string
  readonly userId: string
}

function passwordRegisterTransaction(options: PasswordRegisterTransactionOptions): Result<PasswordRegisterCommit> {
  const op = "passwordRegister"
  if (options.method === "whatsapp") {
    const limited = passwordRegistrationRateLimitConsume(options.database, {
      clientIp: options.clientIp,
      delivery: false,
      identifier: options.phoneNumber ?? "unknown",
      now: options.now,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      verify: false,
    })
    if (!limited.success) return limited
    if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })
  }
  const repository = passwordRepositoryCreate(options.database)
  const duplicate = passwordRegisterDuplicateFind(repository, options)
  if (!duplicate.success) return duplicate
  if (duplicate.data) return passwordRegisterDuplicateCommit(repository, options)

  const user = userRepositoryCreate(options.database).userCreate(
    {
      createdAt: options.now,
      deletedAt: null,
      email: options.email,
      emailVerifiedAt: null,
      id: options.userId,
      phoneNumber: options.phoneNumber,
      phoneNumberVerifiedAt: null,
      realmId: options.realmId,
      registrationVerifiedAt: null,
      registrationVerificationMethod: null,
      state: "initial",
      updatedAt: options.now,
      userName: options.userName,
      version: 1,
    },
    {
      displayName: options.profile.displayName,
      firstName: options.profile.firstName,
      gender: options.profile.gender,
      realmId: options.realmId,
      lastName: options.profile.lastName,
      nickName: options.profile.nickName,
      preferredLanguage: options.profile.preferredLanguage,
      updatedAt: options.now,
      userId: options.userId,
    },
  )
  if (!user.success) {
    const concurrentDuplicate = passwordRegisterDuplicateFind(repository, options)
    if (!concurrentDuplicate.success) return concurrentDuplicate
    if (!concurrentDuplicate.data)
      return resultErrorCreate(op, "The registration could not be completed.", "passwords.write-failed")
    return passwordRegisterDuplicateCommit(repository, options)
  }
  if (options.method === "whatsapp") {
    const deliveryLimited = passwordRegistrationRateLimitConsume(options.database, {
      clientIp: options.clientIp,
      delivery: true,
      identifier: options.phoneNumber ?? "unknown",
      now: options.now,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      request: false,
      verify: false,
    })
    if (!deliveryLimited.success) return deliveryLimited
    if (!deliveryLimited.data.allowed) return resultCreate({ rateLimited: true, retryAt: deliveryLimited.data.retryAt })
  }
  const credential = repository.passwordCredentialCreate({
    changedAt: options.now,
    createdAt: options.now,
    hash: options.hash,
    realmId: options.realmId,
    userId: options.userId,
    version: 1,
  })
  if (!credential.success) return credential

  if (options.method === "email") {
    const challenge = repository.passwordChallengeCreate({
      createdAt: options.now,
      expiresAt: options.now + 24 * 60 * 60 * 1_000,
      id: options.challengeId,
      kind: "verification",
      realmId: options.realmId,
      tokenHash: passwordTokenHashCreate(options.token ?? ""),
      userId: options.userId,
      version: 1,
    })
    if (!challenge.success) return challenge
  } else {
    const previous = repository.passwordRegistrationChallengeExpirePrevious(
      options.realmId,
      options.userId,
      "registration",
      options.now,
    )
    if (!previous.success) return previous
    const challenge = repository.passwordRegistrationChallengeCreate({
      attempts: 0,
      codeHash: passwordRegistrationCodeHashCreate(options.challengeId, options.code ?? ""),
      consumedAt: null,
      cooldownUntil: options.now + passwordRegistrationChallengeCooldownMs,
      createdAt: options.now,
      expiresAt: options.now + passwordRegistrationChallengeExpiryMs,
      id: options.challengeId,
      identityHash: options.identityHash ?? null,
      maxAttempts: passwordRegistrationChallengeMaxAttempts,
      purpose: "registration",
      realmId: options.realmId,
      userId: options.userId,
      version: 1,
    })
    if (!challenge.success) return challenge
  }

  const userPayload = v.safeParse(userCreatedEventPayloadSchema, {
    emailVerified: false,
    phoneNumberVerified: false,
    registrationVerified: false,
    registrationVerificationMethod: null,
    state: "initial",
  })
  if (!userPayload.success)
    return resultErrorCreate(op, "The registration event payload is invalid.", "passwords.event-invalid")
  const userEvent = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "user",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.created,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passwords" },
      occurredAt: options.now,
      payload: userPayload.output,
    },
    options.runtime,
  )
  if (!userEvent.success) return userEvent
  const credentialPayload = v.safeParse(passwordCredentialChangedEventPayloadSchema, { reason: "registration" })
  if (!credentialPayload.success)
    return resultErrorCreate(op, "The password event payload is invalid.", "passwords.event-invalid")
  const credentialEvent = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "password",
      aggregateVersion: 1,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: passwordEventTypes.credentialChanged,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passwords" },
      occurredAt: options.now,
      payload: credentialPayload.output,
    },
    options.runtime,
  )
  if (!credentialEvent.success) return credentialEvent
  const requestedPayload = v.safeParse(passwordRegistrationEventPayloadSchema, {
    ...(options.method === "whatsapp" ? { verificationMethod: "whatsapp" as const } : {}),
    verificationRequired: true,
  })
  if (!requestedPayload.success)
    return resultErrorCreate(op, "The verification event payload is invalid.", "passwords.event-invalid")
  const requestedEvent = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "password",
      aggregateVersion: 2,
      commandIndex: 2,
      correlationId: options.correlationId,
      eventType:
        options.method === "whatsapp"
          ? passwordEventTypes.whatsappVerificationRequested
          : passwordEventTypes.emailVerificationRequested,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "passwords" },
      occurredAt: options.now,
      payload: requestedPayload.output,
    },
    options.runtime,
  )
  if (!requestedEvent.success) return requestedEvent
  const response = passwordRegistrationAcceptedCreate(
    options.method,
    options.challengeId,
    options.now + passwordRegistrationChallengeExpiryMs,
    options.now + passwordRegistrationChallengeCooldownMs,
  )
  return resultCreate({
    duplicate: false,
    response,
    ...(options.method === "email" ? { token: options.token } : {}),
    ...(options.method === "whatsapp"
      ? {
          whatsappDelivery: {
            challengeId: options.challengeId,
            code: options.code ?? "",
            expiresAt: options.now + passwordRegistrationChallengeExpiryMs,
            phoneNumber: options.phoneNumber ?? "",
            realmId: options.realmId,
            userId: options.userId,
          },
        }
      : {}),
  })
}

function passwordRegistrationAcceptedCreate(
  method: "email" | "whatsapp",
  challengeId: string,
  expiresAt: number,
  retryAt: number,
): PasswordRegistrationResponse {
  if (method === "whatsapp")
    return {
      accepted: true,
      challengeId,
      expiresAt,
      retryAt,
      verificationMethod: "whatsapp",
      verificationRequired: true,
    }
  return { accepted: true, verificationRequired: true }
}

function passwordRegisterDuplicateFind(
  repository: ReturnType<typeof passwordRepositoryCreate>,
  options: PasswordRegisterTransactionOptions,
): Result<boolean> {
  const existing = repository.passwordUserFindByIdentifier(options.realmId, options.email)
  if (!existing.success) return existing
  if (existing.data !== null) return resultCreate(true)
  const existingName = repository.passwordUserFindByIdentifier(options.realmId, options.userName)
  if (!existingName.success) return existingName
  if (existingName.data !== null) return resultCreate(true)
  const existingVerifiedEmail = repository.passwordUserFindByVerifiedIdentifier(options.realmId, options.userName)
  if (!existingVerifiedEmail.success) return existingVerifiedEmail
  if (existingVerifiedEmail.data !== null) return resultCreate(true)
  if (options.method !== "whatsapp") return resultCreate(false)
  const existingPhone = repository.passwordUserFindByPhoneNumber(options.realmId, options.phoneNumber ?? "")
  if (!existingPhone.success) return existingPhone
  return resultCreate(existingPhone.data !== null)
}

function passwordRegisterDuplicateCommit(
  repository: ReturnType<typeof passwordRepositoryCreate>,
  options: PasswordRegisterTransactionOptions,
): Result<PasswordRegisterCommit> {
  if (options.method === "email")
    return resultCreate({
      duplicate: true,
      response: { accepted: true, verificationRequired: true },
    })
  if (options.identityHash === undefined || options.code === undefined)
    return resultErrorCreate(
      "passwordRegister",
      "The registration decoy could not be created.",
      "passwords.write-failed",
    )
  const latest = repository.passwordRegistrationChallengeLatestDecoyGet(
    options.realmId,
    options.identityHash,
    "registration",
  )
  if (!latest.success) return latest
  if (
    latest.data !== null &&
    latest.data.consumedAt === null &&
    latest.data.expiresAt > options.now &&
    latest.data.cooldownUntil > options.now
  )
    return resultCreate({
      duplicate: true,
      response: passwordRegistrationAcceptedCreate(
        options.method,
        latest.data.id,
        latest.data.expiresAt,
        latest.data.cooldownUntil,
      ),
    })
  if (latest.data !== null && latest.data.consumedAt === null) {
    const expired = repository.passwordRegistrationChallengeExpirePreviousByIdentity(
      options.realmId,
      options.identityHash,
      "registration",
      options.now,
    )
    if (!expired.success) return expired
  }
  const created = repository.passwordRegistrationChallengeCreate({
    attempts: 0,
    codeHash: passwordRegistrationCodeHashCreate(options.challengeId, options.code),
    consumedAt: null,
    cooldownUntil: options.now + passwordRegistrationChallengeCooldownMs,
    createdAt: options.now,
    expiresAt: options.now + passwordRegistrationChallengeExpiryMs,
    identityHash: options.identityHash,
    id: options.challengeId,
    maxAttempts: passwordRegistrationChallengeMaxAttempts,
    purpose: "registration",
    realmId: options.realmId,
    userId: null,
    version: 1,
  })
  if (!created.success) {
    const raced = repository.passwordRegistrationChallengeLatestDecoyGet(
      options.realmId,
      options.identityHash,
      "registration",
    )
    if (!raced.success) return raced
    if (
      raced.data !== null &&
      raced.data.consumedAt === null &&
      raced.data.expiresAt > options.now &&
      raced.data.cooldownUntil > options.now
    )
      return resultCreate({
        duplicate: true,
        response: passwordRegistrationAcceptedCreate(
          options.method,
          raced.data.id,
          raced.data.expiresAt,
          raced.data.cooldownUntil,
        ),
      })
    return created
  }
  return resultCreate({
    duplicate: true,
    response: passwordRegistrationAcceptedCreate(
      options.method,
      created.data.id,
      created.data.expiresAt,
      created.data.cooldownUntil,
    ),
  })
}

function passwordVerificationTokenInvoke(
  callback: ((delivery: PasswordRegistrationDelivery) => void) | undefined,
  delivery: PasswordRegistrationDelivery,
): void {
  try {
    callback?.(delivery)
  } catch (_error) {}
}

function passwordWhatsappDeliveryInvoke(
  deliveryPort: PasswordWhatsappDeliveryPort,
  delivery: PasswordRegistrationWhatsappDelivery,
): void {
  try {
    void deliveryPort
      .sendText({
        phoneNumber: delivery.phoneNumber,
        text: `Your Authworks registration verification code is ${delivery.code}.`,
      })
      .catch(() => undefined)
  } catch (_error) {}
}
