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
import { projectApplicationNameNormalize } from "../domain/projectApplicationNameNormalize.js"
import { projectApplicationPublicViewCreate } from "../domain/projectApplicationPublicViewCreate.js"
import { projectApplicationCreatedEventPayloadSchema } from "../events/projectApplicationCreatedEventPayloadSchema.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  type ProjectApplicationCreateRequest,
  projectApplicationCreateRequestSchema,
} from "../public/projectApplicationCreateRequestSchema.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectApplicationCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectApplicationCreateRequest
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectApplicationCreate(
  options: ProjectApplicationCreateOptions,
): Result<{ application: ProjectApplication }> {
  const op = "projectApplicationCreate"
  const parsed = v.safeParse(projectApplicationCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The application request is invalid.", "projects.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The application timestamp is invalid.", "projects.timestamp-invalid")
  const applicationId = uuidv7Create(runtime)
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
      permission: "project.app.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const name = projectApplicationNameNormalize(parsed.output.name)
    if (!name.success) return name
    const created = repository.projectApplicationCreate({
      applicationType: parsed.output.applicationType,
      createdAt,
      id: applicationId,
      realmId: options.realmId,
      name: name.data,
      projectId: options.projectId,
      status: "active",
      updatedAt: createdAt,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(projectApplicationCreatedEventPayloadSchema, {
      applicationId,
      applicationType: parsed.output.applicationType,
      name: name.data,
      projectId: options.projectId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The application event payload is invalid.", "projects.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: applicationId,
        aggregateType: "project_application",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.applicationCreated,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ application: projectApplicationPublicViewCreate(created.data) })
  })
}
