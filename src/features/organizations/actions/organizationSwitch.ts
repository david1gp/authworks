import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { organizationContextCreate } from "../domain/organizationContextCreate.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationSwitchedEventPayloadSchema } from "../events/organizationSwitchedEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationSwitchRequest,
  organizationSwitchRequestSchema,
} from "../public/organizationSwitchRequestSchema.js"
import type { OrganizationSwitchResponse } from "../public/organizationSwitchResponseSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationSwitchOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationSwitchRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationSwitch(options: OrganizationSwitchOptions): Result<OrganizationSwitchResponse> {
  const op = "organizationSwitch"
  const parsed = v.safeParse(organizationSwitchRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The organization switch request is invalid.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The organization is not available in this tenant context.")
  const runtime = options.runtime ?? options.database.runtime
  const switchedAt = runtime.now()
  if (!Number.isSafeInteger(switchedAt) || switchedAt < 0)
    return resultErrorCreate(op, "The organization timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const organization = repository.organizationGet(parsed.output.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.instanceId !== options.instanceId ||
      organization.data.status !== "active"
    )
      return resultErrorCreate(op, "The organization is not active or was not found.")
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository,
      requiredPermission: "organization.switch",
    })
    if (!authorized.success) return authorized
    const payload = v.safeParse(organizationSwitchedEventPayloadSchema, { organizationId: organization.data.id })
    if (!payload.success) return resultErrorCreate(op, "The organization event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: organization.data.id,
        aggregateType: "organization_switch",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.switched,
        instanceId: options.instanceId,
        metadata: { source: "organizations" },
        occurredAt: switchedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      activeOrganizationId: organization.data.id,
      context: organizationContextCreate(
        options.instanceId,
        organization.data.id,
        options.context.actorId,
        options.context.actor,
      ),
      organization: organizationPublicViewCreate(organization.data),
    })
  })
}
