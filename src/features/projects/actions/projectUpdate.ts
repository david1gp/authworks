import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectNameNormalize } from "../domain/projectNameNormalize.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectUpdatedEventPayloadSchema } from "../events/projectUpdatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { Project } from "../public/projectSchema.js"
import { type ProjectUpdateRequest, projectUpdateRequestSchema } from "../public/projectUpdateRequestSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectUpdateRequest
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectUpdate(options: ProjectUpdateOptions): Result<{ project: Project }> {
  const op = "projectUpdate"
  const parsed = patchInputParse(op, projectUpdateRequestSchema, options.input, "projects.empty-patch")
  if (!parsed.success) return parsed
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The project is not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCodedCreate(op, "The project timestamp is invalid.", "projects.timestamp-invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectGet(options.projectId)
    if (!current.success) return current
    if (current.data === null || current.data.realmId !== options.realmId || current.data.status !== "active")
      return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.write",
      project: current.data,
    })
    if (!authorized.success) return authorized
    const name =
      parsed.data.name === undefined ? resultCreate(current.data.name) : projectNameNormalize(parsed.data.name)
    if (!name.success) return name
    const updated = repository.projectUpdate(options.projectId, {
      authorizationRequired:
        parsed.data.authorizationRequired === undefined
          ? current.data.authorizationRequired
          : parsed.data.authorizationRequired
            ? 1
            : 0,
      name: name.data,
      projectAccessRequired:
        parsed.data.projectAccessRequired === undefined
          ? current.data.projectAccessRequired
          : parsed.data.projectAccessRequired
            ? 1
            : 0,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success)
      return resultErrorCodedCreate(
        op,
        "A project with that name already exists in this organization.",
        "projects.already-exists",
      )
    if (updated.data === null) return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    const payload = v.safeParse(projectUpdatedEventPayloadSchema, {
      authorizationRequired: updated.data.authorizationRequired === 1,
      name: updated.data.name,
      projectAccessRequired: updated.data.projectAccessRequired === 1,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project event payload is invalid.", "projects.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.projectId,
        aggregateType: "project",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.updated,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ project: projectPublicViewCreate(updated.data) })
  })
}
