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
import { machineCredentialIssuedEventPayloadSchema } from "../events/machineCredentialIssuedEventPayloadSchema.js"
import { machineUserCreatedEventPayloadSchema } from "../events/machineUserCreatedEventPayloadSchema.js"
import { machineEventTypes } from "../events/machineEventTypes.js"
import { machineSecretCreate } from "../domain/machineSecretCreate.js"
import { machineSecretHashCreate } from "../domain/machineSecretHashCreate.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import {
  machineUserCreateRequestSchema,
  type MachineUserCreateRequest,
} from "../public/machineUserCreateRequestSchema.js"
import type { MachineUserCreateResponse } from "../public/machineUserCreateResponseSchema.js"

type MachineUserCreateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: MachineUserCreateRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineUserCreate(options: MachineUserCreateOptions): Result<MachineUserCreateResponse> {
  const op = "machineUserCreate"
  const authorized = machineUserContextAuthorize(options)
  if (!authorized.success) return authorized
  const parsed = v.safeParse(machineUserCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The machine user request is invalid.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")

  const userName = parsed.output.userName.trim().toLowerCase()
  if (!/^[a-z][a-z0-9._:-]*$/.test(userName)) return resultErrorCreate(op, "The machine user request is invalid.")
  const scopes = [...new Set(parsed.output.scopes ?? [])]
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The machine user timestamp is invalid.")
  const machineUserId = uuidv7Create(runtime)
  const credentialId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const secret = machineSecretCreate(runtime)
  if (!secret.success) return secret
  const secretHash = machineSecretHashCreate(secret.data, runtime)
  if (!secretHash.success) return secretHash

  return storageTransactionRun(options.database, (transaction) => {
    const repository = machineRepositoryCreate(transaction)
    const user = repository.userCreate({
      createdAt,
      displayName: parsed.output.displayName.trim(),
      id: machineUserId,
      instanceId: options.instanceId,
      scopes: JSON.stringify(scopes),
      status: "active",
      updatedAt: createdAt,
      userName,
      version: 1,
    })
    if (!user.success) {
      if (user.errorMessage === "The machine user could not be created.")
        return resultErrorCreate(op, "A machine user with that name already exists in this instance.")
      return user
    }
    const credential = repository.credentialCreate({
      createdAt,
      expiresAt: null,
      id: credentialId,
      instanceId: options.instanceId,
      kind: "client_secret",
      machineUserId,
      name: null,
      replacedById: null,
      revokedAt: null,
      scopes: JSON.stringify(scopes),
      secretHash: secretHash.data,
      version: 1,
    })
    if (!credential.success) return credential

    const userPayload = v.safeParse(machineUserCreatedEventPayloadSchema, {
      displayName: user.data.displayName,
      scopes,
      status: user.data.status,
      userName: user.data.userName,
    })
    const credentialPayload = v.safeParse(machineCredentialIssuedEventPayloadSchema, {
      credentialId,
      credentialKind: "client_secret",
      machineUserId,
      scopes,
    })
    if (!userPayload.success || !credentialPayload.success)
      return resultErrorCreate(op, "The machine user event payload is invalid.")
    const userEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: machineUserId,
        aggregateType: "machine_user",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: machineEventTypes.userCreated,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "machine-users" },
        occurredAt: createdAt,
        payload: userPayload.output,
      },
      runtime,
    )
    if (!userEvent.success) return userEvent
    const credentialEvent = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: credentialId,
        aggregateType: "machine_credential",
        aggregateVersion: 1,
        commandIndex: 1,
        correlationId,
        eventType: machineEventTypes.credentialIssued,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "machine-users" },
        occurredAt: createdAt,
        payload: credentialPayload.output,
      },
      runtime,
    )
    if (!credentialEvent.success) return credentialEvent
    return resultCreate({
      clientId: userName,
      clientSecret: secret.data,
      machineUser: machineUserPublicViewCreate(user.data, scopes),
    })
  })
}
