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
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationLoginPolicyChangedEventPayloadSchema } from "../events/organizationLoginPolicyChangedEventPayloadSchema.js"
import { organizationLoginPolicyDefaults } from "../domain/organizationLoginPolicyDefaults.js"
import { organizationLoginPolicyViewCreate } from "../domain/organizationLoginPolicyViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import {
  type OrganizationLoginPolicySetRequest,
  organizationLoginPolicySetRequestSchema,
} from "../public/organizationLoginPolicySetRequestSchema.js"
import { organizationLoginPolicyOverrideViewCreate } from "../domain/organizationLoginPolicyOverrideViewCreate.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationLoginPolicySetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationLoginPolicySetRequest
  readonly instanceId: string
  readonly organizationId?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationLoginPolicySet(
  options: OrganizationLoginPolicySetOptions,
): Result<OrganizationLoginPolicyResponse> {
  return organizationLoginPolicySetRun({
    ...options,
    scope: options.organizationId === undefined ? "instance" : "organization",
  })
}

function organizationLoginPolicySetRun(
  options: Omit<OrganizationLoginPolicySetOptions, "organizationId"> & {
    readonly organizationId?: string
    readonly scope: "instance" | "organization"
  },
): Result<OrganizationLoginPolicyResponse> {
  const op = options.scope === "instance" ? "organizationInstanceLoginPolicySet" : "organizationLoginPolicySet"
  const parsed = v.safeParse(organizationLoginPolicySetRequestSchema, options.input)
  if (!parsed.success || Object.keys(parsed.output).length === 0)
    return resultErrorCreate(op, "The login policy update is invalid.")
  if (options.context.kind !== "system")
    return resultErrorCreate(op, "Only the system context can configure login policy.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The login policy timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun<OrganizationLoginPolicyResponse>(options.database, (transaction) => {
    const repository = organizationLoginPolicyRepositoryCreate(transaction)
    const organizationRepository = organizationRepositoryCreate(transaction)
    if (options.scope === "organization") {
      const organization = organizationRepository.organizationGet(options.organizationId ?? "")
      if (!organization.success) return organization
      if (
        organization.data === null ||
        organization.data.instanceId !== options.instanceId ||
        organization.data.status !== "active"
      )
        return resultErrorCreate(op, "The organization was not found.")
      const instance = repository.instanceLoginPolicyGet(options.instanceId)
      if (!instance.success) return instance
      const authorized = organizationContextAuthorize({
        context: options.context,
        organization: organization.data,
        repository: organizationRepository,
        requiredPermission: "organization.manage",
      })
      if (!authorized.success) return authorized
      const current = repository.organizationLoginPolicyGet(options.organizationId ?? "")
      if (!current.success) return current
      const saved =
        current.data === null
          ? repository.organizationLoginPolicyCreate({
              ...organizationLoginPolicyOverrideValues(parsed.output),
              instanceId: options.instanceId,
              organizationId: options.organizationId ?? "",
              updatedAt: now,
              version: 1,
            })
          : repository.organizationLoginPolicyUpdate(options.organizationId ?? "", {
              ...organizationLoginPolicyOverrideValues(parsed.output),
              updatedAt: now,
              version: current.data.version + 1,
            })
      if (!saved.success) return saved
      if (saved.data === null) return resultErrorCreate(op, "The login policy could not be saved.")
      const effective = organizationLoginPolicyViewCreate(instance.data, saved.data)
      const event = organizationLoginPolicyChangedEventAppend({
        aggregateId: options.organizationId ?? "",
        aggregateVersion: saved.data.version,
        actorId: options.context.actorId,
        correlationId,
        eventInstanceId: options.instanceId,
        effective,
        occurredAt: now,
        runtime,
        transaction,
      })
      if (!event.success) return event
      return resultCreate({
        instanceId: options.instanceId,
        organizationId: options.organizationId ?? "",
        overrides: organizationLoginPolicyOverrideViewCreate(saved.data),
        policy: effective,
      })
    }
    const current = repository.instanceLoginPolicyGet(options.instanceId)
    if (!current.success) return current
    const currentEffective = organizationLoginPolicyViewCreate(current.data, null)
    const saved =
      current.data === null
        ? repository.instanceLoginPolicyCreate({
            ...organizationLoginPolicyInstanceValues(parsed.output, currentEffective),
            instanceId: options.instanceId,
            updatedAt: now,
            version: 1,
          })
        : repository.instanceLoginPolicyUpdate(options.instanceId, {
            ...organizationLoginPolicyInstanceValues(parsed.output, currentEffective),
            updatedAt: now,
            version: current.data.version + 1,
          })
    if (!saved.success) return saved
    if (saved.data === null) return resultErrorCreate(op, "The login policy could not be saved.")
    const effective = organizationLoginPolicyViewCreate(saved.data, null)
    const event = organizationLoginPolicyChangedEventAppend({
      aggregateId: options.instanceId,
      aggregateVersion: saved.data.version,
      actorId: options.context.actorId,
      correlationId,
      eventInstanceId: options.instanceId,
      effective,
      occurredAt: now,
      runtime,
      transaction,
    })
    if (!event.success) return event
    return resultCreate({
      instanceId: options.instanceId,
      organizationId: null,
      overrides: organizationLoginPolicyOverrideViewCreate(saved.data),
      policy: effective,
    })
  })
}

function organizationLoginPolicyOverrideValues(input: OrganizationLoginPolicySetRequest) {
  return {
    ...(input.allowDomainDiscovery === undefined ? {} : { allowDomainDiscovery: input.allowDomainDiscovery }),
    ...(input.allowEmailOtp === undefined ? {} : { allowEmailOtp: input.allowEmailOtp }),
    ...(input.allowExternalIdentity === undefined ? {} : { allowExternalIdentity: input.allowExternalIdentity }),
    ...(input.allowPassword === undefined ? {} : { allowPassword: input.allowPassword }),
    ...(input.allowPasswordRecovery === undefined ? {} : { allowPasswordRecovery: input.allowPasswordRecovery }),
    ...(input.allowPasskey === undefined ? {} : { allowPasskey: input.allowPasskey }),
    ...(input.allowRegistration === undefined ? {} : { allowRegistration: input.allowRegistration }),
    ...(input.providerIds === undefined
      ? {}
      : { providerIds: input.providerIds === null ? null : JSON.stringify(input.providerIds) }),
  }
}

function organizationLoginPolicyInstanceValues(
  input: OrganizationLoginPolicySetRequest,
  current: ReturnType<typeof organizationLoginPolicyViewCreate>,
) {
  return {
    allowDomainDiscovery: input.allowDomainDiscovery ?? current.allowDomainDiscovery,
    allowEmailOtp: input.allowEmailOtp ?? current.allowEmailOtp,
    allowExternalIdentity: input.allowExternalIdentity ?? current.allowExternalIdentity,
    allowPassword: input.allowPassword ?? current.allowPassword,
    allowPasswordRecovery: input.allowPasswordRecovery ?? current.allowPasswordRecovery,
    allowPasskey: input.allowPasskey ?? current.allowPasskey,
    allowRegistration: input.allowRegistration ?? current.allowRegistration,
    providerIds:
      input.providerIds === undefined
        ? current.providerIds === null
          ? null
          : JSON.stringify(current.providerIds)
        : input.providerIds === null
          ? null
          : JSON.stringify(input.providerIds),
  }
}

type OrganizationLoginPolicyChangedEventAppendOptions = {
  readonly actorId: string
  readonly aggregateId: string
  readonly aggregateVersion: number
  readonly correlationId: string
  readonly eventInstanceId: string
  readonly effective: ReturnType<typeof organizationLoginPolicyViewCreate>
  readonly occurredAt: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly transaction: Parameters<typeof storageEventAppend>[0]
}

function organizationLoginPolicyChangedEventAppend(
  options: OrganizationLoginPolicyChangedEventAppendOptions,
): Result<unknown> {
  const payload = v.safeParse(organizationLoginPolicyChangedEventPayloadSchema, { policy: options.effective })
  if (!payload.success)
    return resultErrorCreate("organizationLoginPolicySet", "The login policy event payload is invalid.")
  return storageEventAppend(
    options.transaction,
    {
      actorId: options.actorId,
      aggregateId: options.aggregateId,
      aggregateType: "login_policy",
      aggregateVersion: options.aggregateVersion,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: organizationEventTypes.loginPolicyChanged,
      instanceId: options.eventInstanceId,
      metadata: { source: "organizations" },
      occurredAt: options.occurredAt,
      payload: payload.output,
    },
    options.runtime,
  )
}
