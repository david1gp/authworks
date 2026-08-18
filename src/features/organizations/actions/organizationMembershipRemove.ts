import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationMembershipRemovedEventPayloadSchema } from "../events/organizationMembershipRemovedEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationMembershipRemoveOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly membershipId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationMembershipRemove(options: OrganizationMembershipRemoveOptions): Result<{ removed: true }> {
  const op = "organizationMembershipRemove"
  const runtime = options.runtime ?? options.database.runtime
  const removedAt = runtime.now()
  if (!Number.isSafeInteger(removedAt) || removedAt < 0)
    return resultErrorCodedCreate(op, "The membership timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const current = repository.organizationMembershipGet(options.membershipId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.realmId !== options.realmId ||
      current.data.organizationId !== options.organizationId
    )
      return resultErrorCodedCreate(op, "The organization membership was not found.", "organizations.not-found")
    const organization = repository.organizationGet(current.data.organizationId)
    if (!organization.success) return organization
    if (organization.data === null || organization.data.status !== "active")
      return resultErrorCodedCreate(op, "The organization is not active or was not found.", "organizations.not-found")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository,
      requiredPermission: "organization.members.manage",
    })
    if (!authorized.success) return authorized
    const roles = organizationRolesDecode(current.data.roles)
    if (!roles.success) return roles
    if (roles.data.includes("owner")) {
      const memberships = repository.organizationMembershipList(current.data.organizationId)
      if (!memberships.success) return memberships
      let ownerCount = 0
      for (const membership of memberships.data) {
        const membershipRoles = organizationRolesDecode(membership.roles)
        if (!membershipRoles.success) return membershipRoles
        if (membershipRoles.data.includes("owner")) ownerCount += 1
      }
      if (ownerCount === 1)
        return resultErrorCodedCreate(op, "The organization must retain an owner.", "organizations.must-retain")
    }
    const removed = repository.organizationMembershipDelete(options.membershipId)
    if (!removed.success) return removed
    if (removed.data === null)
      return resultErrorCodedCreate(op, "The organization membership was not found.", "organizations.not-found")
    const payload = v.safeParse(organizationMembershipRemovedEventPayloadSchema, {
      membershipId: removed.data.id,
      userId: removed.data.userId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The membership event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: removed.data.id,
        aggregateType: "organization_membership",
        aggregateVersion: removed.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.membershipRemoved,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: removedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true as const })
  })
}
