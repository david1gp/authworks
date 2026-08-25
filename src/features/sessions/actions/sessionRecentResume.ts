import { and, eq } from "drizzle-orm"
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
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { realmBootstrapAdminTable } from "../../realms/persistence/realmBootstrapAdminTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { sessionCredentialCreate } from "../domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionEventTypes } from "../events/sessionEventTypes.js"
import { sessionRotatedEventPayloadSchema } from "../events/sessionRotatedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionRow } from "../persistence/sessionTable.js"
import type { SessionCredentialResponse } from "../public/sessionCredentialResponseSchema.js"
import { sessionSchema } from "../public/sessionSchema.js"
import { sessionAuthenticate } from "./sessionAuthenticate.js"

type SessionRecentResumeOptions = {
  readonly database: StorageDatabase
  readonly organizationId?: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionId: string
  readonly token: string
}

const sessionRecentLimit = 5
const sessionDefaultLifetimeMs = 30 * 24 * 60 * 60 * 1_000

export function sessionRecentResume(options: SessionRecentResumeOptions): Result<SessionCredentialResponse> {
  const op = "sessionRecentResume"
  if (options.realmId.length === 0 || options.sessionId.length === 0 || options.token.length === 0)
    return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const authenticated = sessionAuthenticate({
    database: options.database,
    realmId: options.realmId,
    runtime,
    token: options.token,
  })
  if (!authenticated.success) return resultErrorCreate(op, "Session resume is invalid.", "sessions.unauthorized")
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The session timestamp is invalid.", "sessions.invalid-timestamp")
  const nextToken = sessionCredentialCreate(runtime)
  const nextHash = sessionCredentialHashCreate(nextToken)
  const correlationId = uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = sessionRepositoryCreate(transaction)
    const current = repository.sessionGet(options.realmId, authenticated.data.session.id)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.tokenHash !== sessionCredentialHashCreate(options.token) ||
      current.data.revokedAt !== null ||
      current.data.expiresAt <= now
    )
      return resultErrorCreate(op, "Session resume is invalid.", "sessions.unauthorized")

    const selected = repository.sessionGet(options.realmId, options.sessionId)
    if (!selected.success) return selected
    if (selected.data === null) return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    const selectedSession = selected.data
    if (!sessionRecentResumeOwnershipValid(current.data, selectedSession, authenticated.data.actor.actorId))
      return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    if (selectedSession.revokedAt !== null || selectedSession.expiresAt <= now)
      return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    const selectedView = v.safeParse(sessionSchema, sessionPublicViewCreate(selectedSession))
    if (!selectedView.success) return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    if (!sessionRecentResumeSubjectValidate(transaction, selectedSession, selectedView.output.subjectType))
      return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    if (!sessionRecentResumeAssuranceValid(current.data.assurance, selectedView.output.assurance))
      return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    const recent = repository.sessionList(
      options.realmId,
      authenticated.data.actor.actorId,
      sessionRecentLimit,
      selectedView.output.subjectType,
    )
    if (!recent.success) return recent
    if (!recent.data.some((session) => session.id === selectedSession.id))
      return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")

    const policy = organizationLoginPolicyResolve({
      database: options.database,
      executor: transaction,
      organizationId: options.organizationId,
      realmId: options.realmId,
    })
    if (!policy.success) return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    const sessionLifetimeMs = (policy.data.sessionLifetimeSeconds ?? sessionDefaultLifetimeMs / 1_000) * 1_000
    const policyExpiresAt = now + sessionLifetimeMs
    if (!Number.isSafeInteger(policyExpiresAt))
      return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    const expiresAt = Math.min(selectedSession.expiresAt, policyExpiresAt)
    const rotated = repository.sessionRotate(
      options.realmId,
      selectedSession.id,
      selectedSession.tokenHash,
      nextHash,
      now,
      selectedSession.version,
      selectedSession.version + 1,
      expiresAt,
    )
    if (!rotated.success) return rotated
    if (rotated.data === null) return resultErrorCreate(op, "Session resume is invalid.", "sessions.invalid")
    const eventVersion = repository.sessionEventVersionGet(options.realmId, selectedSession.id)
    if (!eventVersion.success) return eventVersion
    const payload = v.safeParse(sessionRotatedEventPayloadSchema, {
      rotatedAt: now,
      sessionId: selectedSession.id,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The session event payload is invalid.", "sessions.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: selectedSession.subjectId,
        aggregateId: selectedSession.id,
        aggregateType: "session",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: sessionEventTypes.rotated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "sessions" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ session: sessionPublicViewCreate(rotated.data, true), token: nextToken })
  })
}

function sessionRecentResumeOwnershipValid(
  current: {
    readonly impersonationOrganizationId: string | null
    readonly impersonationPermissions: string | null
    readonly impersonationReason: string | null
    readonly impersonatorId: string | null
    readonly realmId: string
    readonly subjectId: string
    readonly subjectType: string
    readonly userId: string | null
  },
  selected: {
    readonly impersonationOrganizationId: string | null
    readonly impersonationPermissions: string | null
    readonly impersonationReason: string | null
    readonly impersonatorId: string | null
    readonly realmId: string
    readonly subjectId: string
    readonly subjectType: string
    readonly userId: string | null
  },
  actorId: string,
): boolean {
  return (
    current.realmId === selected.realmId &&
    selected.subjectId === actorId &&
    current.subjectId === actorId &&
    current.subjectType === selected.subjectType &&
    current.userId === selected.userId &&
    current.impersonatorId === selected.impersonatorId &&
    current.impersonationOrganizationId === selected.impersonationOrganizationId &&
    current.impersonationPermissions === selected.impersonationPermissions &&
    current.impersonationReason === selected.impersonationReason
  )
}

function sessionRecentResumeSubjectValidate(
  database: StorageExecutor,
  session: SessionRow,
  subjectType: "bootstrap_admin" | "user",
): boolean {
  if (subjectType === "user") {
    const user = database
      .select({ state: userTable.state })
      .from(userTable)
      .where(and(eq(userTable.realmId, session.realmId), eq(userTable.id, session.subjectId)))
      .get()
    return (
      user?.state === "active" &&
      session.userId === session.subjectId &&
      session.authenticationMethod !== "bootstrap_admin"
    )
  }
  const bootstrap = database
    .select({ adminId: realmBootstrapAdminTable.adminId })
    .from(realmBootstrapAdminTable)
    .where(
      and(
        eq(realmBootstrapAdminTable.realmId, session.realmId),
        eq(realmBootstrapAdminTable.adminId, session.subjectId),
      ),
    )
    .get()
  return (
    bootstrap !== undefined &&
    session.userId === null &&
    session.authenticationMethod === "bootstrap_admin" &&
    session.assurance === "authenticated" &&
    session.mfaMethod === null &&
    session.impersonatorId === null &&
    session.impersonationOrganizationId === null &&
    session.impersonationPermissions === null &&
    session.impersonationReason === null
  )
}

function sessionRecentResumeAssuranceValid(
  current: "authenticated" | "multi_factor" | string,
  selected: "authenticated" | "multi_factor" | string,
): boolean {
  return sessionAssuranceRankGet(selected) <= sessionAssuranceRankGet(current)
}

function sessionAssuranceRankGet(value: string): number {
  if (value === "multi_factor") return 2
  if (value === "authenticated") return 1
  return 0
}
