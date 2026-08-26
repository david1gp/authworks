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
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { realmBootstrapAdminTable } from "../../realms/persistence/realmBootstrapAdminTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { sessionCredentialCreate } from "../domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionEventTypes } from "../events/sessionEventTypes.js"
import { sessionRotatedEventPayloadSchema } from "../events/sessionRotatedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionAssuranceRequiredDetails } from "../public/sessionAssuranceRequiredDetailsSchema.js"
import type { SessionCredentialResponse } from "../public/sessionCredentialResponseSchema.js"
import { sessionSubjectTypeSchema } from "../public/sessionSubjectTypeSchema.js"

type SessionRotateOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

export function sessionRotate(options: SessionRotateOptions): Result<SessionCredentialResponse> {
  const op = "sessionRotate"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
  const nextToken = sessionCredentialCreate(runtime)
  const nextHash = sessionCredentialHashCreate(nextToken)
  const correlationId = uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = sessionRepositoryCreate(transaction)
    const current = repository.sessionGetByTokenHash(sessionCredentialHashCreate(options.token))
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.realmId !== options.realmId ||
      current.data.revokedAt !== null ||
      current.data.expiresAt <= now
    )
      return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    const organizationContext = organizationLoginContextValidate({
      context: {
        ...(current.data.organizationId === null ? {} : { organizationId: current.data.organizationId }),
        realmId: current.data.realmId,
      },
      executor: transaction,
      expectedRealmId: options.realmId,
    })
    if (!organizationContext.success) return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    const policy = organizationLoginPolicyResolve({
      database: options.database,
      executor: transaction,
      organizationId: organizationContext.data.organizationId,
      realmId: options.realmId,
    })
    if (!policy.success) return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    const requiredAssurance =
      policy.data.requiredMfa && current.data.subjectType === "user"
        ? "multi_factor"
        : policy.data.minimumStepUpAssurance
    if (sessionAssuranceRankGet(current.data.assurance) < sessionAssuranceRankGet(requiredAssurance)) {
      const details: SessionAssuranceRequiredDetails = {
        action: "step_up",
        organizationId: organizationContext.data.organizationId ?? null,
        requiredAssurance,
      }
      return resultErrorCreate(
        op,
        "Stronger authentication is required for this session rotation.",
        "sessions.assurance-required",
        details,
      )
    }
    const subjectType = v.safeParse(sessionSubjectTypeSchema, current.data.subjectType)
    if (!subjectType.success) return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    if (subjectType.output === "user") {
      const user = transaction
        .select({ state: userTable.state })
        .from(userTable)
        .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, current.data.subjectId)))
        .get()
      if (user === undefined || user.state !== "active" || current.data.userId !== current.data.subjectId)
        return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
      if (current.data.authenticationMethod === "bootstrap_admin")
        return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    }
    if (subjectType.output === "bootstrap_admin") {
      const bootstrap = transaction
        .select({ adminId: realmBootstrapAdminTable.adminId })
        .from(realmBootstrapAdminTable)
        .where(
          and(
            eq(realmBootstrapAdminTable.realmId, options.realmId),
            eq(realmBootstrapAdminTable.adminId, current.data.subjectId),
          ),
        )
        .get()
      if (
        bootstrap === undefined ||
        current.data.userId !== null ||
        current.data.authenticationMethod !== "bootstrap_admin" ||
        current.data.assurance !== "authenticated" ||
        current.data.mfaMethod !== null
      )
        return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
      if (
        current.data.impersonatorId !== null ||
        current.data.impersonationOrganizationId !== null ||
        current.data.impersonationPermissions !== null ||
        current.data.impersonationReason !== null
      )
        return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    }
    if (current.data.impersonatorId !== null) {
      const impersonator = transaction
        .select({ id: userTable.id, state: userTable.state })
        .from(userTable)
        .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, current.data.impersonatorId)))
        .get()
      const bootstrap = transaction
        .select({ id: realmBootstrapAdminTable.adminId })
        .from(realmBootstrapAdminTable)
        .where(
          and(
            eq(realmBootstrapAdminTable.realmId, options.realmId),
            eq(realmBootstrapAdminTable.adminId, current.data.impersonatorId),
          ),
        )
        .get()
      if ((impersonator === undefined || impersonator.state !== "active") && bootstrap === undefined)
        return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    }
    const rotated = repository.sessionRotate(
      options.realmId,
      current.data.id,
      current.data.tokenHash,
      nextHash,
      now,
      current.data.version,
      current.data.version + 1,
    )
    if (!rotated.success) return rotated
    if (rotated.data === null) return resultErrorCreate(op, "Session rotation is invalid.", "sessions.invalid")
    const eventVersion = repository.sessionEventVersionGet(options.realmId, current.data.id)
    if (!eventVersion.success) return eventVersion
    const payload = v.safeParse(sessionRotatedEventPayloadSchema, { rotatedAt: now, sessionId: current.data.id })
    if (!payload.success)
      return resultErrorCreate(op, "The session event payload is invalid.", "sessions.event-invalid")
    const eventInput = {
      actorId: current.data.subjectId,
      aggregateId: current.data.id,
      aggregateType: "session" as const,
      aggregateVersion: eventVersion.data + 1,
      commandIndex: 0,
      correlationId,
      eventType: sessionEventTypes.rotated,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "sessions" },
      occurredAt: now,
      payload: payload.output,
    }
    const event =
      subjectType.output === "user"
        ? eventSecurityEventAppend(transaction, { ...eventInput, userSubjectId: current.data.subjectId }, runtime)
        : eventSecurityUnindexedEventAppend(
            transaction,
            { ...eventInput, unindexedReason: "bootstrap_admin_session" },
            runtime,
          )
    if (!event.success) return event
    return resultCreate({ session: sessionPublicViewCreate(rotated.data, true), token: nextToken })
  })
}

function sessionAssuranceRankGet(value: string): number {
  if (value === "multi_factor") return 2
  if (value === "authenticated") return 1
  return 0
}
