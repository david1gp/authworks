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
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaPolicy } from "../public/mfaPolicySchema.js"
import { mfaPolicySetRequestSchema, type MfaPolicySetRequest } from "../public/mfaPolicySetRequestSchema.js"

type MfaPolicySetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: MfaPolicySetRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function mfaPolicySet(options: MfaPolicySetOptions): Result<{ policy: MfaPolicy }> {
  const op = "mfaPolicySet"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can set the MFA policy.")
  const input = v.safeParse(mfaPolicySetRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The MFA policy is invalid.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return instance
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The MFA policy timestamp is invalid.")
  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const existing = repository.mfaPolicyGet(options.instanceId)
    if (!existing.success) return existing
    const row = repository.mfaPolicySet({
      instanceId: options.instanceId,
      lockoutDurationMs: input.output.lockoutDurationMs,
      maxAttempts: input.output.maxAttempts,
      mode: input.output.mode,
      totpWindow: input.output.totpWindow,
      updatedAt: now,
      version: (existing.data?.version ?? 0) + 1,
    })
    if (!row.success) return row
    const payload = v.safeParse(mfaEventPayloadSchema, { mode: input.output.mode })
    if (!payload.success) return resultErrorCreate(op, "The MFA policy event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.instanceId,
        aggregateType: "mfa_policy",
        aggregateVersion: row.data.version,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.policyChanged,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ policy: input.output })
  })
}
