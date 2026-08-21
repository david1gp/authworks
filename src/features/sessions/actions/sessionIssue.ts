import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import { authorizationPermissionSchema } from "../../authorization/public/authorizationPermissionSchema.js"
import { sessionCredentialCreate } from "../domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionCreatedEventPayloadSchema } from "../events/sessionCreatedEventPayloadSchema.js"
import { sessionEventTypes } from "../events/sessionEventTypes.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionAssurance } from "../public/sessionAssuranceSchema.js"
import { sessionAssuranceSchema } from "../public/sessionAssuranceSchema.js"
import type { SessionAuthenticationMethod } from "../public/sessionAuthenticationMethodSchema.js"
import { sessionAuthenticationMethodSchema } from "../public/sessionAuthenticationMethodSchema.js"
import type { SessionCredentialResponse } from "../public/sessionCredentialResponseSchema.js"
import { type SessionDeviceMetadata, sessionDeviceMetadataSchema } from "../public/sessionDeviceMetadataSchema.js"
import type { SessionMfaMethod } from "../public/sessionMfaMethodSchema.js"
import { sessionMfaMethodSchema } from "../public/sessionMfaMethodSchema.js"
import { type SessionSubjectType, sessionSubjectTypeSchema } from "../public/sessionSubjectTypeSchema.js"

type SessionIssueOptions = {
  readonly actorId?: string | null
  readonly assurance: SessionAssurance
  readonly authenticationMethod: SessionAuthenticationMethod
  readonly commandIndex?: number
  readonly correlationId?: string
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly database?: StorageDatabase
  readonly executor?: StorageExecutor
  readonly expiresAt?: number
  readonly realmId: string
  readonly impersonationOrganizationId?: string
  readonly impersonationPermissions?: readonly AuthorizationPermission[]
  readonly impersonationReason?: string
  readonly impersonatorId?: string
  readonly mfaMethod?: SessionMfaMethod
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly subjectId?: string
  readonly subjectType?: SessionSubjectType
  readonly userId?: string
}

const sessionDefaultLifetimeMs = 30 * 24 * 60 * 60 * 1_000

export function sessionIssue(options: SessionIssueOptions): Result<SessionCredentialResponse> {
  const op = "sessionIssue"
  if (options.executor === undefined && options.database !== undefined)
    return storageTransactionRun(options.database, (transaction) =>
      sessionIssue({ ...options, database: undefined, executor: transaction }),
    )
  const assurance = v.safeParse(sessionAssuranceSchema, options.assurance)
  if (!assurance.success) return resultErrorCreate(op, "The session assurance is invalid.", "sessions.invalid")
  const authenticationMethod = v.safeParse(sessionAuthenticationMethodSchema, options.authenticationMethod)
  if (!authenticationMethod.success)
    return resultErrorCreate(op, "The session authentication method is invalid.", "sessions.invalid")
  const device = v.safeParse(sessionDeviceMetadataSchema, options.deviceMetadata ?? {})
  if (!device.success) return resultErrorCreate(op, "The session device metadata is invalid.", "sessions.invalid")
  const mfaMethod = v.safeParse(v.optional(sessionMfaMethodSchema), options.mfaMethod)
  if (!mfaMethod.success) return resultErrorCreate(op, "The session MFA method is invalid.", "sessions.invalid")
  const subjectType = v.safeParse(sessionSubjectTypeSchema, options.subjectType ?? "user")
  if (!subjectType.success) return resultErrorCreate(op, "The session subject is invalid.", "sessions.invalid")
  const subjectId = options.subjectId ?? options.userId ?? ""
  if (options.realmId.length === 0 || subjectId.length === 0)
    return resultErrorCreate(op, "The session ownership is invalid.", "sessions.invalid")
  if (subjectType.output === "user" && (options.userId === undefined || options.userId !== subjectId))
    return resultErrorCreate(op, "The session ownership is invalid.", "sessions.invalid")
  const impersonationFields = [
    options.impersonationOrganizationId,
    options.impersonatorId,
    options.impersonationReason,
    options.impersonationPermissions,
  ]
  if (
    impersonationFields.some((field) => field !== undefined) &&
    impersonationFields.some((field) => field === undefined)
  )
    return resultErrorCreate(op, "The impersonation session marker is invalid.", "sessions.invalid")
  if (options.impersonatorId !== undefined && options.impersonatorId === subjectId)
    return resultErrorCreate(op, "The impersonation session marker is invalid.", "sessions.invalid")
  if (
    (subjectType.output === "bootstrap_admin" &&
      (authenticationMethod.output !== "bootstrap_admin" ||
        assurance.output !== "authenticated" ||
        mfaMethod.output !== undefined ||
        impersonationFields.some((field) => field !== undefined))) ||
    (subjectType.output === "user" && authenticationMethod.output === "bootstrap_admin")
  )
    return resultErrorCreate(op, "The session subject is invalid.", "sessions.invalid")
  if (options.impersonatorId !== undefined && options.impersonationReason !== undefined) {
    if (options.impersonationReason.length < 3 || options.impersonationReason.length > 256)
      return resultErrorCreate(op, "The impersonation reason is invalid.", "sessions.invalid")
    const permissions = v.safeParse(v.array(authorizationPermissionSchema), options.impersonationPermissions)
    if (!permissions.success)
      return resultErrorCreate(op, "The impersonation permissions are invalid.", "sessions.forbidden")
    if (options.impersonationOrganizationId !== undefined && options.impersonationOrganizationId.length === 0)
      return resultErrorCreate(op, "The impersonation organization is invalid.", "sessions.invalid")
  }
  const commandIndex = options.commandIndex ?? 0
  if (!Number.isSafeInteger(commandIndex) || commandIndex < 0)
    return resultErrorCreate(op, "The session command index is invalid.", "sessions.invalid")

  const executor = options.executor ?? options.database?.db
  if (executor === undefined) return resultErrorCreate(op, "Session storage is required.", "sessions.invalid")
  const runtime = options.runtime ?? options.database?.runtime ?? runtimeCreate()
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The session timestamp is invalid.", "sessions.invalid-timestamp")
  const expiresAt = options.expiresAt ?? now + sessionDefaultLifetimeMs
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now)
    return resultErrorCreate(op, "The session expiry is invalid.", "sessions.invalid")
  const token = sessionCredentialCreate(runtime)
  if (token.length < 43)
    return resultErrorCreate(op, "The session credential could not be created.", "sessions.write-failed")
  const sessionId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const deviceData = device.output
  const repository = sessionRepositoryCreate(executor)
  const created = repository.sessionCreate({
    assurance: assurance.output,
    authenticationMethod: authenticationMethod.output,
    createdAt: now,
    deviceDescription: deviceData.description ?? null,
    deviceFingerprint: deviceData.fingerprint ?? null,
    expiresAt,
    id: sessionId,
    realmId: options.realmId,
    impersonationOrganizationId: options.impersonationOrganizationId ?? null,
    impersonationPermissions:
      options.impersonationPermissions === undefined ? null : JSON.stringify(options.impersonationPermissions),
    impersonationReason: options.impersonationReason ?? null,
    impersonatorId: options.impersonatorId ?? null,
    ipAddress: deviceData.ipAddress ?? null,
    lastUsedAt: now,
    mfaMethod: mfaMethod.output ?? null,
    revokedAt: null,
    revocationReason: null,
    tokenHash: sessionCredentialHashCreate(token),
    userAgent: deviceData.userAgent ?? null,
    subjectId,
    subjectType: subjectType.output,
    userId: subjectType.output === "user" ? subjectId : null,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(sessionCreatedEventPayloadSchema, {
    assurance: assurance.output,
    authenticationMethod: authenticationMethod.output,
    device: deviceData,
    expiresAt,
    ...(options.impersonationOrganizationId === undefined
      ? {}
      : { impersonationOrganizationId: options.impersonationOrganizationId }),
    ...(options.impersonationReason === undefined ? {} : { impersonationReason: options.impersonationReason }),
    ...(options.impersonatorId === undefined ? {} : { impersonatorId: options.impersonatorId }),
    ...(mfaMethod.output === undefined ? {} : { mfaMethod: mfaMethod.output }),
    sessionId,
    subjectId,
    subjectType: subjectType.output,
    ...(subjectType.output === "user" ? { userId: subjectId } : {}),
  })
  if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.", "sessions.event-invalid")
  const event = storageEventAppend(
    executor,
    {
      actorId: options.actorId,
      aggregateId: sessionId,
      aggregateType: "session",
      aggregateVersion: 1,
      commandIndex,
      correlationId,
      eventType: sessionEventTypes.created,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "sessions" },
      occurredAt: now,
      payload: payload.output,
    },
    runtime,
  )
  if (!event.success) return event
  return resultCreate({ session: sessionPublicViewCreate(created.data, true), token })
}
