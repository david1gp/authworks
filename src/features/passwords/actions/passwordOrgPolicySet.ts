import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationContextAuthorize } from "../../organizations/actions/organizationContextAuthorize.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { passwordOrgPolicyRowCreate } from "../domain/passwordOrgPolicyRowCreate.js"
import { passwordOrgPolicyViewCreate } from "../domain/passwordOrgPolicyViewCreate.js"
import { passwordEventTypes } from "../events/passwordEventTypes.js"
import { passwordPolicyChangedEventPayloadSchema } from "../events/passwordPolicyChangedEventPayloadSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"
import {
  type PasswordPolicySetRequest,
  passwordPolicySetRequestSchema,
} from "../public/passwordPolicySetRequestSchema.js"

type PasswordOrgPolicySetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: PasswordPolicySetRequest
  readonly organizationId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function passwordOrgPolicySet(options: PasswordOrgPolicySetOptions): Result<{ policy: PasswordPolicy }> {
  const op = "passwordOrgPolicySet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The password policy is not available in this tenant context.",
      "passwords.tenant-mismatch",
    )
  const parsed = v.safeParse(passwordPolicySetRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The password policy is invalid.", "passwords.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The realm is not active.", "passwords.not-active")
  const organizations = organizationRepositoryCreate(options.database.db)
  const organization = organizations.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== options.realmId)
    return resultErrorCreate(op, "The organization was not found.", "passwords.not-found")
  if (options.context.kind === "tenant" && organization.data.status !== "active")
    return resultErrorCreate(op, "The organization is not active.", "passwords.not-active")
  const authorized = organizationContextAuthorize({
    context: options.context,
    database: options.database,
    organization: organization.data,
    repository: organizations,
    requiredRole: "admin",
  })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The password policy timestamp is invalid.", "passwords.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = passwordRepositoryCreate(transaction)
    const current = repository.passwordOrgPolicyGet(options.realmId, options.organizationId)
    if (!current.success) return current
    const version = (current.data?.version ?? 0) + 1
    const row = repository.passwordOrgPolicySet(
      passwordOrgPolicyRowCreate(options.realmId, options.organizationId, parsed.output, updatedAt, version),
    )
    if (!row.success) return row
    const payload = v.safeParse(passwordPolicyChangedEventPayloadSchema, parsed.output)
    if (!payload.success)
      return resultErrorCreate(op, "The password policy event payload is invalid.", "passwords.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.organizationId,
        aggregateType: "password_policy",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: passwordEventTypes.policyChanged,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "passwords" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ policy: passwordOrgPolicyViewCreate(row.data) })
  })
}
