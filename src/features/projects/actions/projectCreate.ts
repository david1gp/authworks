import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { organizationGet } from "../../organizations/actions/organizationGet.js"
import { projectOrganizationAuthorize } from "./projectOrganizationAuthorize.js"
import { projectNameNormalize } from "../domain/projectNameNormalize.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectCreatedEventPayloadSchema } from "../events/projectCreatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectCreateRequestSchema, type ProjectCreateRequest } from "../public/projectCreateRequestSchema.js"
import type { Project } from "../public/projectSchema.js"

type ProjectCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectCreateRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectCreate(options: ProjectCreateOptions): Result<{ project: Project }> {
  const op = "projectCreate"
  const parsed = v.safeParse(projectCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The project request is invalid.", "projects.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The project is not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  const systemContext = realmSystemContextCreate()
  const realm = realmGet({ context: systemContext, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCodedCreate(op, "The realm is not active.", "projects.not-active")
  const organization = organizationGet({
    context: systemContext,
    database: options.database,
    realmId: options.realmId,
    organizationId: parsed.output.organizationId,
  })
  if (!organization.success) return organization
  if (organization.data.organization.realmId !== options.realmId)
    return resultErrorCodedCreate(op, "The organization was not found.", "projects.organization-not-found")
  if (organization.data.organization.status !== "active")
    return resultErrorCodedCreate(op, "The organization is not active.", "projects.organization-not-active")
  const authorized = projectOrganizationAuthorize({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    organizationId: parsed.output.organizationId,
    permission: "project.create",
  })
  if (!authorized.success) return authorized
  const name = projectNameNormalize(parsed.output.name)
  if (!name.success) return name
  const authorizationRequired = parsed.output.authorizationRequired ?? false
  const projectAccessRequired = parsed.output.projectAccessRequired ?? false
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The project timestamp is invalid.", "projects.timestamp-invalid")
  const projectId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const created = repository.projectCreate({
      authorizationRequired: authorizationRequired ? 1 : 0,
      createdAt,
      id: projectId,
      realmId: options.realmId,
      name: name.data,
      organizationId: parsed.output.organizationId,
      projectAccessRequired: projectAccessRequired ? 1 : 0,
      status: "active",
      updatedAt: createdAt,
      version: 1,
    })
    if (!created.success) {
      if (created.errorMessage === "The project could not be created.")
        return resultErrorCodedCreate(
          op,
          "A project with that name already exists in this organization.",
          "projects.already-exists",
        )
      return created
    }
    const payload = v.safeParse(projectCreatedEventPayloadSchema, {
      authorizationRequired,
      name: name.data,
      organizationId: parsed.output.organizationId,
      projectAccessRequired,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project event payload is invalid.", "projects.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: projectId,
        aggregateType: "project",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.created,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ project: projectPublicViewCreate(created.data) })
  })
}
