import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/server/index.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userEmailNormalize } from "../domain/userEmailNormalize.js"
import { userNameNormalize } from "../domain/userNameNormalize.js"
import { userPhoneNumberNormalize } from "../domain/userPhoneNumberNormalize.js"
import { userProfileNormalize } from "../domain/userProfileNormalize.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userCreatedEventPayloadSchema } from "../events/userCreatedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { type UserCreateRequest, userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import type { User } from "../public/userSchema.js"

type UserCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: UserCreateRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function userCreate(options: UserCreateOptions): Result<{ user: User }> {
  const op = "userCreate"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const parsed = v.safeParse(userCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The user request is invalid.", "users.invalid")
  const userName = userNameNormalize(parsed.output.userName)
  if (!userName.success) return userName
  const email = userEmailNormalize(parsed.output.email)
  if (!email.success) return email
  const phoneNumber =
    parsed.output.phoneNumber === undefined
      ? resultCreate<string | null>(null)
      : userPhoneNumberNormalize(parsed.output.phoneNumber)
  if (!phoneNumber.success) return phoneNumber
  const profile = userProfileNormalize(parsed.output.profile)
  if (!profile.success) return profile
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active") return resultErrorCreate(op, "The realm is not active.", "users.not-active")

  const runtime = options.runtime ?? options.database.runtime
  const userId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The user timestamp is invalid.", "users.invalid-timestamp")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const created = repository.userCreate(
      {
        createdAt,
        email: email.data,
        emailVerifiedAt: null,
        id: userId,
        phoneNumber: phoneNumber.data,
        phoneNumberVerifiedAt: null,
        realmId: options.realmId,
        registrationVerifiedAt: null,
        registrationVerificationMethod: null,
        state: "initial",
        updatedAt: createdAt,
        userName: userName.data,
        version: 1,
      },
      {
        displayName: profile.data.displayName,
        firstName: profile.data.firstName,
        gender: profile.data.gender,
        realmId: options.realmId,
        lastName: profile.data.lastName,
        nickName: profile.data.nickName,
        pictureContentType: profile.data.picture?.contentType ?? null,
        pictureUrl: profile.data.picture?.url ?? null,
        preferredLanguage: profile.data.preferredLanguage,
        updatedAt: createdAt,
        userId,
      },
    )
    if (!created.success) {
      if (created.errorMessage === "The user could not be created.")
        return resultErrorCreate(
          op,
          "A user with that name or email already exists in this realm.",
          "users.already-exists",
        )
      return created
    }
    const payload = v.safeParse(userCreatedEventPayloadSchema, {
      emailVerified: false,
      phoneNumberVerified: false,
      registrationVerified: false,
      registrationVerificationMethod: null,
      state: "initial",
    })
    if (!payload.success) return resultErrorCreate(op, "The user event payload is invalid.", "users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: userId,
        aggregateType: "user",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.created,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ user: userPublicViewCreate(created.data) })
  })
}
