import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectRolePublicViewCreate } from "../domain/projectRolePublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectRoleCreatedEventPayloadSchema } from "../events/projectRoleCreatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  projectRoleCreateRequestSchema,
  type ProjectRoleCreateRequest,
} from "../public/projectRoleCreateRequestSchema.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectRoleCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectRoleCreateRequest
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectRoleCreate(options: ProjectRoleCreateOptions): Result<{ role: ProjectRole }> {
  const op = "projectRoleCreate"
  const parsed = v.safeParse(projectRoleCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The project role request is invalid.", "projects.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The project role timestamp is invalid.", "projects.timestamp-invalid")
  const roleId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
      return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.role.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const duplicate = repository.projectRoleGetByProjectKey(options.projectId, parsed.output.key)
    if (!duplicate.success) return duplicate
    if (duplicate.data !== null)
      return resultErrorCodedCreate(op, "A project role with that key already exists.", "projects.already-exists")
    const created = repository.projectRoleCreate({
      createdAt,
      displayName: parsed.output.displayName,
      group: parsed.output.group,
      id: roleId,
      realmId: options.realmId,
      key: parsed.output.key,
      projectId: options.projectId,
      updatedAt: createdAt,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(projectRoleCreatedEventPayloadSchema, {
      displayName: parsed.output.displayName,
      ...(parsed.output.group === undefined ? {} : { group: parsed.output.group }),
      key: parsed.output.key,
      projectId: options.projectId,
      roleId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project role event payload is invalid.", "projects.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: roleId,
        aggregateType: "project_role",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.roleCreated,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ role: projectRolePublicViewCreate(created.data) })
  })
}
