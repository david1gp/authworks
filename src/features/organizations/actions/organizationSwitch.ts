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
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationSwitchRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationSwitch(options: OrganizationSwitchOptions): Result<OrganizationSwitchResponse> {
  const op = "organizationSwitch"
  const parsed = v.safeParse(organizationSwitchRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The organization switch request is invalid.", "organizations.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The organization is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const runtime = options.runtime ?? options.database.runtime
  const switchedAt = runtime.now()
  if (!Number.isSafeInteger(switchedAt) || switchedAt < 0)
    return resultErrorCodedCreate(op, "The organization timestamp is invalid.", "organizations.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const organization = repository.organizationGet(parsed.output.organizationId)
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
      requiredPermission: "organization.switch",
    })
    if (!authorized.success) return authorized
    const payload = v.safeParse(organizationSwitchedEventPayloadSchema, { organizationId: organization.data.id })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The organization event payload is invalid.", "organizations.event-invalid")
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
        realmId: options.realmId,
        metadata: { source: "organizations" },
        occurredAt: switchedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      activeOrganizationId: organization.data.id,
      context: {
        actor: options.context.actor,
        actorId: options.context.actorId,
        realmId: options.realmId,
        kind: "organization",
        organizationId: organization.data.id,
      },
      organization: organizationPublicViewCreate(organization.data),
    })
  })
}
