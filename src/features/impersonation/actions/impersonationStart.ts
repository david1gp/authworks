import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
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
  readonly instanceId: string
  readonly onSecurityNotification?: (notification: ImpersonationSecurityNotification) => void | Promise<void>
  readonly organizationId?: string
  readonly reason: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly roles?: readonly string[]
  readonly targetUserId: string
}

export function impersonationStart(options: ImpersonationStartOptions): Result<ImpersonationStartResponse> {
  const op = "impersonationStart"
  if (options.instanceId.length === 0 || options.targetUserId.length === 0)
    return resultErrorCreate(op, "The impersonation target is invalid.")
  if (options.actor.impersonatorId !== undefined)
    return resultErrorCreate(op, "Impersonation sessions cannot start another impersonation session.")
  if (options.actor.kind !== "user" && options.actor.kind !== "bootstrap_admin")
    return resultErrorCreate(op, "The actor is not authorized to impersonate users.")
  if (options.actor.kind === "user" && options.actor.assurance !== "multi_factor")
    return resultErrorCreate(op, "Multi-factor authentication is required to impersonate a user.")
  if (options.actor.actorId === options.targetUserId)
    return resultErrorCreate(op, "An administrator cannot impersonate itself.")
  if (
    !Number.isSafeInteger(options.durationMs) ||
    options.durationMs < 1_000 ||
    options.durationMs > impersonationMaxDurationMs
  )
    return resultErrorCreate(op, "The impersonation duration must be between one second and fifteen minutes.")
  if (options.reason.trim().length < 3 || options.reason.trim().length > 256)
    return resultErrorCreate(op, "An impersonation reason is required.")

  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The impersonation timestamp is invalid.")
  const expiresAt = now + options.durationMs
  if (!Number.isSafeInteger(expiresAt)) return resultErrorCreate(op, "The impersonation expiry is invalid.")
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
            eq(organizationMembershipTable.instanceId, options.instanceId),
          ),
        )
        .get()
      if (actorMembership === undefined) return resultErrorCreate(op, "The actor is not a member of this organization.")
      const decoded = organizationRolesDecode(actorMembership.roles)
      if (!decoded.success) return decoded
      const enforced = authorizationEnforce({
        actor: options.actor,
        instanceId: options.instanceId,
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
        instanceId: userTable.instanceId,
        state: userTable.state,
        deletedAt: userTable.deletedAt,
      })
      .from(userTable)
      .where(and(eq(userTable.id, options.targetUserId), eq(userTable.instanceId, options.instanceId)))
      .get()
    if (target === undefined || target.state !== "active" || target.deletedAt !== null)
      return resultErrorCreate(op, "The impersonation target was not found or is not active.")
    if (options.organizationId !== undefined) {
      const organization = transaction
        .select({
          id: organizationTable.id,
          instanceId: organizationTable.instanceId,
          status: organizationTable.status,
        })
        .from(organizationTable)
        .where(
          and(eq(organizationTable.id, options.organizationId), eq(organizationTable.instanceId, options.instanceId)),
        )
        .get()
      if (organization === undefined || organization.status !== "active")
        return resultErrorCreate(op, "The impersonation organization was not found or is not active.")
      const targetMembership = transaction
        .select({ id: organizationMembershipTable.id })
        .from(organizationMembershipTable)
        .where(
          and(
            eq(organizationMembershipTable.organizationId, options.organizationId),
            eq(organizationMembershipTable.userId, options.targetUserId),
            eq(organizationMembershipTable.instanceId, options.instanceId),
          ),
        )
        .get()
      if (targetMembership === undefined)
        return resultErrorCreate(op, "The target is not a member of this organization.")
    }
    const issued = sessionIssue({
      actorId: options.actor.actorId,
      assurance: options.actor.assurance,
      authenticationMethod: "impersonation",
      correlationId,
      database: undefined,
      executor: transaction,
      expiresAt,
      instanceId: options.instanceId,
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
      instanceId: options.instanceId,
      ...(options.organizationId === undefined ? {} : { organizationId: options.organizationId }),
      reason: options.reason.trim(),
      sessionId: issued.data.session.id,
      subjectId: options.targetUserId,
    })
    if (!payload.success) return resultErrorCreate(op, "The impersonation event payload is invalid.")
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
        instanceId: options.instanceId,
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
    instanceId: options.instanceId,
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
      .select({ roles: organizationMembershipTable.roles, instanceId: organizationMembershipTable.instanceId })
      .from(organizationMembershipTable)
      .where(
        and(
          eq(organizationMembershipTable.organizationId, options.organizationId),
          eq(organizationMembershipTable.userId, options.actor.actorId),
          eq(organizationMembershipTable.instanceId, options.instanceId),
        ),
      )
      .get()
    if (membership === undefined)
      return resultErrorCreate("impersonationAuthorization", "The actor is not a member of this organization.")
    const decoded = organizationRolesDecode(membership.roles)
    if (!decoded.success) return decoded
    roles.push(...decoded.data)
  }
  const actorPolicies = options.actor.scopes?.map((permission) => ({ effect: "allow" as const, permission })) ?? []
  const enforced = authorizationEnforce({
    actor: options.actor,
    instanceId: options.instanceId,
    organizationId: options.organizationId,
    permission: impersonationPermission,
    policies: actorPolicies,
    roles,
  })
  if (!enforced.success) return enforced
  if (options.actor.kind === "bootstrap_admin") {
    const resolved = authorizationRolePermissionsResolve({ roles: ["instance_admin"] })
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
