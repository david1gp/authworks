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
import { passwordPolicyRowCreate } from "../domain/passwordPolicyRowCreate.js"
import { passwordPolicyViewCreate } from "../domain/passwordPolicyViewCreate.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordPolicyChangedEventPayloadSchema } from "../events/passwordPolicyChangedEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import {
  type PasswordPolicySetRequest,
  passwordPolicySetRequestSchema,
} from "../public/passwordPolicySetRequestSchema.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

type PasswordPolicySetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordPolicySetRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function passwordPolicySet(options: PasswordPolicySetOptions): Result<{ policy: PasswordPolicy }> {
  const op = "passwordPolicySet"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can change the password policy.")
  const parsed = v.safeParse(passwordPolicySetRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The password policy is invalid.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The password policy timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = passwordRepositoryCreate(transaction)
    const current = repository.passwordPolicyGet(options.instanceId)
    if (!current.success) return current
    const version = (current.data?.version ?? 0) + 1
    const row = repository.passwordPolicySet(
      passwordPolicyRowCreate(options.instanceId, parsed.output, updatedAt, version),
    )
    if (!row.success) return row
    const payload = v.safeParse(passwordPolicyChangedEventPayloadSchema, parsed.output)
    if (!payload.success) return resultErrorCreate(op, "The password policy event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.instanceId,
        aggregateType: "password_policy",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: passwordEventTypes.policyChanged,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ policy: passwordPolicyViewCreate(row.data) })
  })
}
