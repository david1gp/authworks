import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import { organizationNameNormalize } from "../domain/organizationNameNormalize.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationRolesEncode } from "../domain/organizationRolesEncode.js"
import { organizationCreatedEventPayloadSchema } from "../events/organizationCreatedEventPayloadSchema.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationMembershipEventPayloadSchema } from "../events/organizationMembershipEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationCreateRequest,
  organizationCreateRequestSchema,
} from "../public/organizationCreateRequestSchema.js"
import type { Organization } from "../public/organizationSchema.js"

type OrganizationCreateOptions = {
  readonly context: InstanceSystemContext
  readonly database: StorageDatabase
  readonly input: OrganizationCreateRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationCreate(options: OrganizationCreateOptions): Result<{ organization: Organization }> {
  const op = "organizationCreate"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can create organizations.")
  const parsed = v.safeParse(organizationCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The organization request is invalid.")
  const name = organizationNameNormalize(parsed.output.name)
  if (!name.success) return name
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")

  const runtime = options.runtime ?? options.database.runtime
  const organizationId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The organization timestamp is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const created = repository.organizationCreate({
      createdAt,
      id: organizationId,
      instanceId: options.instanceId,
      name: name.data,
      status: "active",
      updatedAt: createdAt,
      version: 1,
    })
    if (!created.success) {
      if (created.errorMessage === "The organization could not be created.")
        return resultErrorCreate(op, "An organization with that name already exists in this instance.")
      return created
    }

    const payload = v.safeParse(organizationCreatedEventPayloadSchema, { name: name.data })
    if (!payload.success) return resultErrorCreate(op, "The organization event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: organizationId,
        aggregateType: "organization",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.created,
        instanceId: options.instanceId,
        metadata: { source: "organizations" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event

    if (parsed.output.ownerUserId !== undefined) {
      const roles = organizationRolesEncode(["owner"])
      if (!roles.success) return roles
      const membershipId = uuidv7Create(runtime)
      const membership = repository.organizationMembershipCreate({
        createdAt,
        id: membershipId,
        instanceId: options.instanceId,
        organizationId,
        roles: roles.data,
        updatedAt: createdAt,
        userId: parsed.output.ownerUserId,
        version: 1,
      })
      if (!membership.success) return membership
      const membershipPayload = v.safeParse(organizationMembershipEventPayloadSchema, {
        membershipId,
        roles: ["owner"],
        userId: parsed.output.ownerUserId,
      })
      if (!membershipPayload.success) return resultErrorCreate(op, "The membership event payload is invalid.")
      const membershipEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: membershipId,
          aggregateType: "organization_membership",
          aggregateVersion: 1,
          commandIndex: 1,
          correlationId,
          eventType: organizationEventTypes.membershipAdded,
          instanceId: options.instanceId,
          metadata: { source: "organizations" },
          occurredAt: createdAt,
          payload: membershipPayload.output,
        },
        runtime,
      )
      if (!membershipEvent.success) return membershipEvent
    }

    return resultCreate({ organization: organizationPublicViewCreate(created.data) })
  })
}
