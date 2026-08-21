import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationGet } from "../../organizations/actions/organizationGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectGrantPublicViewCreate } from "../domain/projectGrantPublicViewCreate.js"
import { projectRoleKeysEncode } from "../domain/projectRoleKeysEncode.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectGrantCreatedEventPayloadSchema } from "../events/projectGrantCreatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  type ProjectGrantCreateRequest,
  projectGrantCreateRequestSchema,
} from "../public/projectGrantCreateRequestSchema.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectGrantCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectGrantCreateRequest
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectGrantCreate(options: ProjectGrantCreateOptions): Result<{ grant: ProjectGrant }> {
  const op = "projectGrantCreate"
  const parsed = v.safeParse(projectGrantCreateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCodedCreate(op, "The project grant request is invalid.", "projects.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The project grant timestamp is invalid.", "projects.timestamp-invalid")
  const grantId = uuidv7Create(runtime)
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
      permission: "project.grant.create",
      project: project.data,
    })
    if (!authorized.success) return authorized
    if (parsed.output.grantedOrganizationId === project.data.organizationId)
      return resultErrorCodedCreate(op, "A project cannot be granted to its owning organization.", "projects.conflict")
    const organization = organizationGet({
      context: realmSystemContextCreate(),
      database: options.database,
      realmId: options.realmId,
      organizationId: parsed.output.grantedOrganizationId,
    })
    if (!organization.success) return organization
    if (organization.data.organization.realmId !== options.realmId)
      return resultErrorCodedCreate(op, "The granted organization was not found.", "projects.organization-not-found")
    if (organization.data.organization.status !== "active")
      return resultErrorCodedCreate(op, "The granted organization is not active.", "projects.organization-not-active")
    const existing = repository.projectGrantGetByProjectOrganization(
      options.projectId,
      parsed.output.grantedOrganizationId,
    )
    if (!existing.success) return existing
    if (existing.data !== null)
      return resultErrorCodedCreate(
        op,
        "The project is already granted to this organization.",
        "projects.already-exists",
      )
    const roles = projectRoleKeysEncode(parsed.output.roleKeys)
    if (!roles.success) return roles
    const projectRoles = repository.projectRoleList(options.projectId)
    if (!projectRoles.success) return projectRoles
    if (parsed.output.roleKeys.some((key) => !projectRoles.data.some((role) => role.key === key)))
      return resultErrorCodedCreate(
        op,
        "Every granted role key must belong to the project.",
        "projects.role-keys-invalid",
      )
    const created = repository.projectGrantCreate({
      createdAt,
      grantedOrganizationId: parsed.output.grantedOrganizationId,
      id: grantId,
      realmId: options.realmId,
      organizationId: project.data.organizationId,
      projectId: options.projectId,
      roleKeys: roles.data,
      status: "active",
      updatedAt: createdAt,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(projectGrantCreatedEventPayloadSchema, {
      grantedOrganizationId: parsed.output.grantedOrganizationId,
      grantId,
      projectId: options.projectId,
      roleKeys: parsed.output.roleKeys,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project grant event payload is invalid.", "projects.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: grantId,
        aggregateType: "project_grant",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.grantCreated,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const view = projectGrantPublicViewCreate(created.data)
    if (!view.success) return view
    return resultCreate({ grant: view.data })
  })
}
