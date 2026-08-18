import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMembershipPublicViewCreate } from "../domain/organizationMembershipPublicViewCreate.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRolesEncode } from "../domain/organizationRolesEncode.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationMembershipEventPayloadSchema } from "../events/organizationMembershipEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import {
  type OrganizationMembershipUpdateRequest,
  organizationMembershipUpdateRequestSchema,
} from "../public/organizationMembershipUpdateRequestSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationMembershipUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationMembershipUpdateRequest
  readonly realmId: string
  readonly membershipId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationMembershipUpdate(
  options: OrganizationMembershipUpdateOptions,
): Result<{ membership: OrganizationMembership }> {
  const op = "organizationMembershipUpdate"
  const parsed = patchInputParse(
    op,
    organizationMembershipUpdateRequestSchema,
    options.input,
    "organizations.empty-patch",
    "organizations.invalid",
  )
  if (!parsed.success) return parsed
  const roles = organizationRolesEncode(parsed.data.roles)
  if (!roles.success) return roles
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
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
    const oldRoles = organizationRolesDecode(current.data.roles)
    if (!oldRoles.success) return oldRoles
    if (oldRoles.data.includes("owner") && !parsed.data.roles.includes("owner")) {
      const ownerCount = organizationMembershipOwnerCount(repository, current.data.organizationId)
      if (!ownerCount.success) return ownerCount
      if (ownerCount.data === 1)
        return resultErrorCodedCreate(op, "The organization must retain an owner.", "organizations.must-retain")
    }
    const updated = repository.organizationMembershipUpdate(options.membershipId, {
      roles: roles.data,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCodedCreate(op, "The organization membership was not found.", "organizations.not-found")
    const payload = v.safeParse(organizationMembershipEventPayloadSchema, {
      membershipId: updated.data.id,
      roles: parsed.data.roles,
      userId: updated.data.userId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The membership event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: updated.data.id,
        aggregateType: "organization_membership",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.membershipUpdated,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const view = organizationMembershipPublicViewCreate(updated.data)
    if (!view.success) return view
    return resultCreate({ membership: view.data })
  })
}

function organizationMembershipOwnerCount(
  repository: ReturnType<typeof organizationRepositoryCreate>,
  organizationId: string,
): Result<number> {
  let count = 0
  const memberships = repository.organizationMembershipList(organizationId)
  if (!memberships.success) return memberships
  for (const membership of memberships.data) {
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    if (roles.data.includes("owner")) count += 1
  }
  return resultCreate(count)
}
