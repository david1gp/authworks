import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { authorizationRolePermissionsResolve } from "../../authorization/actions/authorizationRolePermissionsResolve.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { organizationRolesDecode } from "../../organizations/domain/organizationRolesDecode.js"
import { organizationMembershipTable } from "../../organizations/persistence/organizationMembershipTable.js"
import { organizationTable } from "../../organizations/persistence/organizationTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { impersonationEventTypes } from "../events/impersonationEventTypes.js"
import { impersonationStartedEventPayloadSchema } from "../events/impersonationStartedEventPayloadSchema.js"
import type { ImpersonationSecurityNotification } from "../public/impersonationSecurityNotificationSchema.js"
import type { ImpersonationStartResponse } from "../public/impersonationStartResponseSchema.js"

const impersonationMaxDurationMs = 15 * 60 * 1_000
const impersonationPermission = authorizationPermissionDefinitions.userImpersonate

type ImpersonationStartOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly durationMs: number
  readonly realmId: string
  readonly onSecurityNotification?: (notification: ImpersonationSecurityNotification) => void | Promise<void>
  readonly organizationId?: string
  readonly reason: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly roles?: readonly string[]
  readonly targetUserId: string
}

export function impersonationStart(options: ImpersonationStartOptions): Result<ImpersonationStartResponse> {
  const op = "impersonationStart"
  if (options.realmId.length === 0 || options.targetUserId.length === 0)
    return resultErrorCreate(op, "The impersonation target is invalid.", "impersonation.invalid")
  if (options.actor.impersonatorId !== undefined)
    return resultErrorCreate(
      op,
      "Impersonation sessions cannot start another impersonation session.",
      "authorization.impersonation-forbidden",
    )
  if (options.actor.kind !== "user" && options.actor.kind !== "bootstrap_admin")
    return resultErrorCreate(
      op,
      "The actor is not authorized to impersonate users.",
      "authorization.impersonation-forbidden",
    )
  if (options.actor.kind === "user" && options.actor.assurance !== "multi_factor")
    return resultErrorCreate(
      op,
      "Multi-factor authentication is required to impersonate a user.",
      "authorization.insufficient-assurance",
    )
  if (options.actor.actorId === options.targetUserId)
    return resultErrorCreate(op, "An administrator cannot impersonate itself.", "authorization.impersonation-forbidden")
  if (
    !Number.isSafeInteger(options.durationMs) ||
    options.durationMs < 1_000 ||
    options.durationMs > impersonationMaxDurationMs
  )
    return resultErrorCreate(
      op,
      "The impersonation duration must be between one second and fifteen minutes.",
      "impersonation.invalid",
    )
  if (options.reason.trim().length < 3 || options.reason.trim().length > 256)
    return resultErrorCreate(op, "An impersonation reason is required.", "impersonation.invalid")

  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The impersonation timestamp is invalid.", "impersonation.invalid-timestamp")
  const expiresAt = now + options.durationMs
  if (!Number.isSafeInteger(expiresAt))
    return resultErrorCreate(op, "The impersonation expiry is invalid.", "impersonation.invalid-timestamp")
  const access = impersonationAccessResolve(options)
  if (!access.success) return access
  const correlationId = uuidv7Create(runtime)

  const committed = storageTransactionRun(options.database, (transaction) => {
    let permissions = access.data.permissions
    if (options.organizationId !== undefined && options.actor.kind === "user") {
      const actorMembership = transaction
        .select({ roles: organizationMembershipTable.roles })
        .from(organizationMembershipTable)
        .where(
          and(
            eq(organizationMembershipTable.organizationId, options.organizationId),
            eq(organizationMembershipTable.userId, options.actor.actorId),
            eq(organizationMembershipTable.realmId, options.realmId),
          ),
        )
        .get()
      if (actorMembership === undefined)
        return resultErrorCreate(op, "The actor is not a member of this organization.", "authorization.forbidden")
      const decoded = organizationRolesDecode(actorMembership.roles)
      if (!decoded.success) return decoded
      const enforced = authorizationEnforce({
        actor: options.actor,
        realmId: options.realmId,
        organizationId: options.organizationId,
        permission: impersonationPermission,
        policies: options.actor.scopes?.map((permission) => ({ effect: "allow" as const, permission })),
        roles: decoded.data,
      })
      if (!enforced.success) return enforced
      const resolved = authorizationRolePermissionsResolve({ roles: decoded.data })
      if (!resolved.success) return resolved
      const currentPermissions = new Set(
        resolved.data.filter((rule) => rule.effect === "allow").map((rule) => rule.permission),
      )
      for (const permission of options.actor.scopes ?? []) currentPermissions.add(permission)
      permissions = [...currentPermissions]
    }
    const target = transaction
      .select({
        id: userTable.id,
        realmId: userTable.realmId,
        state: userTable.state,
        deletedAt: userTable.deletedAt,
      })
      .from(userTable)
      .where(and(eq(userTable.id, options.targetUserId), eq(userTable.realmId, options.realmId)))
      .get()
    if (target === undefined || target.state !== "active" || target.deletedAt !== null)
      return resultErrorCreate(
        op,
        "The impersonation target was not found or is not active.",
        "impersonation.not-found",
      )
    if (options.organizationId !== undefined) {
      const organization = transaction
        .select({
          id: organizationTable.id,
          realmId: organizationTable.realmId,
          status: organizationTable.status,
        })
        .from(organizationTable)
        .where(and(eq(organizationTable.id, options.organizationId), eq(organizationTable.realmId, options.realmId)))
        .get()
      if (organization === undefined || organization.status !== "active")
        return resultErrorCreate(
          op,
          "The impersonation organization was not found or is not active.",
          "impersonation.not-found",
        )
      const targetMembership = transaction
        .select({ id: organizationMembershipTable.id })
        .from(organizationMembershipTable)
        .where(
          and(
            eq(organizationMembershipTable.organizationId, options.organizationId),
            eq(organizationMembershipTable.userId, options.targetUserId),
            eq(organizationMembershipTable.realmId, options.realmId),
          ),
        )
        .get()
      if (targetMembership === undefined)
        return resultErrorCreate(op, "The target is not a member of this organization.", "impersonation.not-found")
    }
    const issued = sessionIssue({
      actorId: options.actor.actorId,
      assurance: options.actor.assurance,
      authenticationMethod: "impersonation",
      correlationId,
      database: undefined,
      executor: transaction,
      expiresAt,
      realmId: options.realmId,
      impersonationOrganizationId: options.organizationId,
      impersonationPermissions: permissions,
      impersonationReason: options.reason.trim(),
      impersonatorId: options.actor.actorId,
      runtime,
      userId: options.targetUserId,
    })
    if (!issued.success) return issued
    const payload = v.safeParse(impersonationStartedEventPayloadSchema, {
      actorId: options.actor.actorId,
      assurance: options.actor.assurance,
      expiresAt,
      realmId: options.realmId,
      ...(options.organizationId === undefined ? {} : { organizationId: options.organizationId }),
      reason: options.reason.trim(),
      sessionId: issued.data.session.id,
      subjectId: options.targetUserId,
    })
    if (!payload.success)
      return resultErrorCreate(op, "The impersonation event payload is invalid.", "impersonation.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.actor.actorId,
        aggregateId: issued.data.session.id,
        aggregateType: "impersonation",
        aggregateVersion: 1,
        commandIndex: 1,
        correlationId,
        eventType: impersonationEventTypes.started,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "impersonation" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate(issued.data)
  })
  if (!committed.success) return committed
  impersonationSecurityNotificationInvoke(options.onSecurityNotification, {
    actorId: options.actor.actorId,
    realmId: options.realmId,
    kind: "started",
    ...(options.organizationId === undefined ? {} : { organizationId: options.organizationId }),
    sessionId: committed.data.session.id,
    subjectId: options.targetUserId,
  })
  return committed
}

function impersonationAccessResolve(options: ImpersonationStartOptions): Result<{ permissions: string[] }> {
  const roles = [...(options.roles ?? [])]
  if (options.organizationId !== undefined && options.actor.kind === "user") {
    const membership = options.database.db
      .select({ roles: organizationMembershipTable.roles, realmId: organizationMembershipTable.realmId })
      .from(organizationMembershipTable)
      .where(
        and(
          eq(organizationMembershipTable.organizationId, options.organizationId),
          eq(organizationMembershipTable.userId, options.actor.actorId),
          eq(organizationMembershipTable.realmId, options.realmId),
        ),
      )
      .get()
    if (membership === undefined)
      return resultErrorCreate(
        "impersonationAuthorization",
        "The actor is not a member of this organization.",
        "authorization.forbidden",
      )
    const decoded = organizationRolesDecode(membership.roles)
    if (!decoded.success) return decoded
    roles.push(...decoded.data)
  }
  const actorPolicies = options.actor.scopes?.map((permission) => ({ effect: "allow" as const, permission })) ?? []
  const enforced = authorizationEnforce({
    actor: options.actor,
    realmId: options.realmId,
    organizationId: options.organizationId,
    permission: impersonationPermission,
    policies: actorPolicies,
    roles,
  })
  if (!enforced.success) return enforced
  if (options.actor.kind === "bootstrap_admin") {
    const resolved = authorizationRolePermissionsResolve({ roles: ["realm_admin"] })
    if (!resolved.success) return resolved
    return resultCreate({
      permissions: resolved.data.filter((rule) => rule.effect === "allow").map((rule) => rule.permission),
    })
  }
  const resolved = authorizationRolePermissionsResolve({ roles })
  if (!resolved.success) return resolved
  const permissions = new Set(resolved.data.filter((rule) => rule.effect === "allow").map((rule) => rule.permission))
  for (const permission of options.actor.scopes ?? []) permissions.add(permission)
  return resultCreate({ permissions: [...permissions] })
}

function impersonationSecurityNotificationInvoke(
  port: ((value: ImpersonationSecurityNotification) => void | Promise<void>) | undefined,
  value: ImpersonationSecurityNotification,
): void {
  if (port === undefined) return
  try {
    void Promise.resolve(port(value)).catch(() => undefined)
  } catch (_error) {}
}
