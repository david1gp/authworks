import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationLoginContextResolve } from "../../organizations/server/organizationLoginContextResolve.js"
import { userSessionContextValidate } from "../../users/server/userSessionContextValidate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import { sessionTable } from "../persistence/sessionTable.js"
import type { SessionAssurance } from "../public/sessionAssuranceSchema.js"
import type { Session } from "../public/sessionSchema.js"

type SessionOrganizationContextSetOptions = {
  readonly executor: StorageExecutor
  readonly organizationId: string
  readonly realmId: string
  readonly sessionId: string
  readonly now: number
  readonly userId: string
  readonly expectedAssurance: SessionAssurance
}

export function sessionOrganizationContextSet(options: SessionOrganizationContextSetOptions): Result<Session> {
  const op = "sessionOrganizationContextSet"
  const context = organizationLoginContextResolve({
    executor: options.executor,
    organizationId: options.organizationId,
    realmId: options.realmId,
  })
  if (!context.success)
    return resultErrorCodedCreate(op, "The session organization context is invalid.", "sessions.invalid")
  const user = userSessionContextValidate({
    executor: options.executor,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!user.success)
    return resultErrorCodedCreate(op, "The session organization context is invalid.", "sessions.unauthorized")
  const session = options.executor
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.realmId, options.realmId),
        eq(sessionTable.id, options.sessionId),
        eq(sessionTable.subjectId, options.userId),
        eq(sessionTable.userId, options.userId),
      ),
    )
    .get()
  if (
    session === undefined ||
    session.revokedAt !== null ||
    session.expiresAt <= options.now ||
    session.assurance === "none" ||
    session.subjectType !== "user" ||
    session.assurance !== options.expectedAssurance
  )
    return resultErrorCodedCreate(op, "The session organization context is invalid.", "sessions.unauthorized")
  const currentContext = organizationLoginContextResolve({
    executor: options.executor,
    organizationId: session.organizationId,
    realmId: session.realmId,
  })
  if (!currentContext.success)
    return resultErrorCodedCreate(op, "The session organization context is invalid.", "sessions.unauthorized")
  const updated = sessionRepositoryCreate(options.executor).sessionOrganizationContextSet(
    options.realmId,
    options.sessionId,
    options.userId,
    context.data.organizationId!,
    session.version,
  )
  if (!updated.success) return updated
  if (updated.data === null)
    return resultErrorCodedCreate(op, "The session organization context is stale.", "sessions.unauthorized")
  return resultCreate(sessionPublicViewCreate(updated.data, true))
}
