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
import { organizationMembershipPublicViewCreate } from "../domain/organizationMembershipPublicViewCreate.js"
import { organizationRolesEncode } from "../domain/organizationRolesEncode.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationMembershipEventPayloadSchema } from "../events/organizationMembershipEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationMembershipCreateRequest,
  organizationMembershipCreateRequestSchema,
} from "../public/organizationMembershipCreateRequestSchema.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationMembershipCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationMembershipCreateRequest
  readonly realmId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationMembershipCreate(
  options: OrganizationMembershipCreateOptions,
): Result<{ membership: OrganizationMembership }> {
  const op = "organizationMembershipCreate"
  const parsed = v.safeParse(organizationMembershipCreateRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization membership request is invalid.", "organizations.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The membership is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const roles = organizationRolesEncode(parsed.output.roles)
  if (!roles.success) return roles
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The membership timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const organization = repository.organizationGet(options.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      return resultErrorCodedCreate(op, "The organization is not active or was not found.", "organizations.not-found")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository,
      requiredPermission: "organization.members.manage",
    })
    if (!authorized.success) return authorized
    const existing = repository.organizationMembershipGetByOrganizationUser(
      options.organizationId,
      parsed.output.userId,
    )
    if (!existing.success) return existing
    if (existing.data !== null)
      return resultErrorCodedCreate(
        op,
        "The user is already a member of this organization.",
        "organizations.already-exists",
      )
    const membershipId = uuidv7Create(runtime)
    const membership = repository.organizationMembershipCreate({
      createdAt,
      id: membershipId,
      realmId: options.realmId,
      organizationId: options.organizationId,
      roles: roles.data,
      updatedAt: createdAt,
      userId: parsed.output.userId,
      version: 1,
    })
    if (!membership.success) return membership
    const payload = v.safeParse(organizationMembershipEventPayloadSchema, {
      membershipId,
      roles: parsed.output.roles,
      userId: parsed.output.userId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The membership event payload is invalid.", "organizations.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: membershipId,
        aggregateType: "organization_membership",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.membershipAdded,
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const view = organizationMembershipPublicViewCreate(membership.data)
    if (!view.success) return view
    return resultCreate({ membership: view.data })
  })
}
