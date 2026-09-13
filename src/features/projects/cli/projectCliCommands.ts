import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { authworksLocalCredentialLookup } from "../../connectionProfiles/public/index.js"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { projectApiClientCreate } from "../client/projectApiClientCreate.js"

type ProjectCliFlags = {
  readonly envFile?: string
  readonly project?: string
  readonly profile?: string
  readonly server?: string
  readonly systemToken?: string
  readonly token?: string
}
type ProjectListCliFlags = ProjectCliFlags & {
  readonly pageSize?: string
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type ProjectIdCliFlags = ProjectCliFlags & { readonly projectId?: string; readonly realmId?: string }
type ProjectGetCliFlags = ProjectIdCliFlags & { readonly ifModifiedSince?: string }
type ProjectUserAssignmentCliFlags = ProjectIdCliFlags & { readonly assignmentId: string }

const projectCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectCliFlags & { name: string; organizationId?: string; realmId?: string },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const organizationId = scopeIdResolve(this, connection.data.organizationId, "organization")
    if (realmId === undefined || organizationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectCreate(realmId, {
        authorizationRequired: false,
        name: flags.name,
        organizationId,
        projectAccessRequired: false,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      organizationId: projectScopeIdFlag("Organization UUID"),
      name: textFlag("Project name"),
    },
  },
  docs: { brief: "Create a project" },
})

const projectListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & { realmId?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectList(realmId, projectListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: { flags: { ...projectCommonFlags(), ...projectListFlags(), realmId: projectScopeIdFlag("Realm UUID") } },
  docs: { brief: "List projects" },
})

const projectGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectGetCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGet(
        realmId,
        projectId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      ifModifiedSince: ifModifiedSinceFlag(),
    },
  },
  docs: { brief: "Get a project" },
})

const projectUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { name: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectUpdate(realmId, projectId, { name: flags.name }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      name: textFlag("Project name"),
    },
  },
  docs: { brief: "Rename a project" },
})

const projectLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { status: "active" | "inactive" | "removed" }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectLifecycleSet(realmId, projectId, {
        status: flags.status,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      status: statusFlag(),
    },
  },
  docs: { brief: "Change a project lifecycle status" },
})

const projectApplicationCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectIdCliFlags & { name: string; applicationType: "oidc" | "api" | "saml" },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationCreate(realmId, projectId, {
        applicationType: flags.applicationType,
        name: flags.name,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      name: textFlag("Application name"),
      applicationType: applicationTypeFlag(),
    },
  },
  docs: { brief: "Create an application" },
})

const projectApplicationListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationList(
        realmId,
        projectId,
        projectListQueryCreate(flags),
      ),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      ...projectListFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "List applications" },
})

const projectRoleCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { key: string; displayName: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectRoleCreate(realmId, projectId, {
        displayName: flags.displayName,
        key: flags.key,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      key: textFlag("Role key"),
      displayName: textFlag("Role display name"),
    },
  },
  docs: { brief: "Create a project role" },
})

const projectRoleListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectRoleList(realmId, projectId, projectListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      ...projectListFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "List project roles" },
})

const projectGrantCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectIdCliFlags & { grantedOrganizationId?: string; roleKeys: string },
  ) {
    const connection = await projectCliConnectionResolve(this, {
      ...flags,
      organizationId: flags.grantedOrganizationId,
    })
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const grantedOrganizationId = scopeIdResolve(this, connection.data.organizationId, "organization")
    if (realmId === undefined || projectId === undefined || grantedOrganizationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGrantCreate(realmId, projectId, {
        grantedOrganizationId,
        roleKeys: flags.roleKeys.length === 0 ? [] : flags.roleKeys.split(","),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      grantedOrganizationId: projectScopeIdFlag("Granted organization UUID"),
      roleKeys: textFlag("Comma-separated project role keys"),
    },
  },
  docs: { brief: "Create a project grant" },
})

const projectGrantListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGrantList(realmId, projectId, projectListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      ...projectListFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "List project grants" },
})

const projectUserAssignmentCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { roleKeys?: string; userId: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    const userId = await projectUserAssignmentUserIdResolve(this, flags)
    if (!userId.success) return projectCliResultWrite(this, userId)
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectUserAssignmentCreate(realmId, projectId, {
        ...(flags.roleKeys === undefined ? {} : { roleKeys: projectUserAssignmentRoleKeysParse(flags.roleKeys) }),
        userId: userId.data,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      userId: idFlag("User UUID or local credential alias"),
      roleKeys: { ...textFlag("Comma-separated project role keys"), optional: true as const },
    },
  },
  docs: { brief: "Assign a user to a project" },
})

const projectUserAssignmentListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectUserAssignmentList(
        realmId,
        projectId,
        projectListQueryCreate(flags),
      ),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      ...projectListFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "List project user assignments" },
})

const projectUserAssignmentUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectUserAssignmentCliFlags & { roleKeys?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectUserAssignmentUpdate(
        realmId,
        projectId,
        flags.assignmentId,
        {
          ...(flags.roleKeys === undefined ? {} : { roleKeys: projectUserAssignmentRoleKeysParse(flags.roleKeys) }),
        },
      ),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      assignmentId: idFlag("Assignment UUID"),
      roleKeys: { ...textFlag("Comma-separated project role keys; empty clears roles"), optional: true as const },
    },
  },
  docs: { brief: "Update a project user assignment" },
})

const projectUserAssignmentRemoveCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectUserAssignmentCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectUserAssignmentRemove(realmId, projectId, flags.assignmentId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      assignmentId: idFlag("Assignment UUID"),
    },
  },
  docs: { brief: "Remove a project user assignment" },
})

export const projectCliCommands = buildRouteMap({
  aliases: {
    assign: "assignmentCreate",
    assignmentAssign: "assignmentCreate",
    assignmentEdit: "assignmentUpdate",
    assignmentUnassign: "assignmentRemove",
    edit: "assignmentUpdate",
    unassign: "assignmentRemove",
  },
  routes: {
    assignmentCreate: projectUserAssignmentCreateCommand,
    assignmentList: projectUserAssignmentListCommand,
    assignmentRemove: projectUserAssignmentRemoveCommand,
    assignmentUpdate: projectUserAssignmentUpdateCommand,
    applicationCreate: projectApplicationCreateCommand,
    applicationList: projectApplicationListCommand,
    create: projectCreateCommand,
    get: projectGetCommand,
    grantCreate: projectGrantCreateCommand,
    grantList: projectGrantListCommand,
    lifecycle: projectLifecycleCommand,
    list: projectListCommand,
    roleCreate: projectRoleCreateCommand,
    roleList: projectRoleListCommand,
    update: projectUpdateCommand,
  },
  docs: { brief: "Project, application, role, grant, and assignment administration" },
})

async function projectCliConnectionResolve(
  context: ApplicationContext,
  flags: ProjectCliFlags & { readonly realmId?: string; readonly organizationId?: string },
) {
  const connection = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!connection.success) return connection
  return {
    data: {
      ...connection.data,
      systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
    },
    success: true as const,
  }
}

function projectCliClientCreate(flags: {
  readonly server: string
  readonly systemToken?: string
  readonly token?: string
}) {
  return projectApiClientCreate({
    baseUrl: flags.server,
    systemToken: flags.systemToken,
    token: flags.token,
  })
}

function projectCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; status?: "current" | "unchanged"; success: boolean },
  secrets: readonly (string | undefined)[] = [],
) {
  if (!result.success) {
    context.process.stderr.write(
      `${connectionProfileCliOutputRedact(result.errorMessage ?? "The request failed.", secrets)}\n`,
    )
    context.process.exitCode = 1
    return
  }
  if (result.status === "unchanged") {
    context.process.stderr.write("304 Not Modified\n")
    return
  }
  context.process.stdout.write(
    `${connectionProfileCliOutputRedact(JSON.stringify(result.data) ?? "undefined", secrets)}\n`,
  )
}

function projectCommonFlags() {
  return {
    ...connectionProfileCliCentralFlags(),
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "Bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
    systemToken: {
      brief: "System bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function projectListFlags() {
  return {
    pageSize: { ...textFlag("Maximum items per page"), optional: true as const },
    pageToken: { ...textFlag("Opaque page token"), optional: true as const },
    sortBy: { ...textFlag("Sort field"), optional: true as const },
    sortDirection: {
      ...textFlag("Sort direction"),
      optional: true as const,
      parse: (value: string) => value as "asc" | "desc",
    },
  }
}

function projectListQueryCreate(flags: ProjectListCliFlags): ListQuery | undefined {
  if (
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined
  )
    return undefined
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: Number(flags.pageSize) }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function projectUserAssignmentRoleKeysParse(value: string): string[] {
  return value.length === 0 ? [] : value.split(",")
}

async function projectUserAssignmentUserIdResolve(
  context: ApplicationContext,
  flags: ProjectIdCliFlags & { readonly userId: string },
) {
  const parsedUserId = v.safeParse(userResourceIdSchema, flags.userId)
  if (parsedUserId.success) return resultCreate(parsedUserId.output)

  const credential = await authworksLocalCredentialLookup({
    alias: flags.userId,
    envFile: flags.envFile,
    environment: context.process.env,
    profile: flags.profile,
    project: flags.project,
  })
  if (!credential.success) return credential
  if (credential.data === undefined)
    return resultErrorCreate("projectUserAssignmentUserIdResolve", `Credential alias "${flags.userId}" was not found.`)
  return resultCreate(credential.data.userId)
}

function idFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "UUID" }
}

function projectScopeIdFlag(brief: string) {
  return { ...idFlag(brief), optional: true as const }
}

function projectIdResolve(context: ApplicationContext, projectId: string | undefined): string | undefined {
  if (projectId !== undefined && projectId.trim().length > 0) return projectId
  context.process.stderr.write("Expected input for flag --project-id\n")
  context.process.exitCode = 1
  return undefined
}

function ifModifiedSinceFlag() {
  return {
    brief: "HTTP If-Modified-Since date",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "HTTP-DATE",
  }
}

function textFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function statusFlag() {
  return {
    brief: "Lifecycle status",
    kind: "parsed" as const,
    parse: (value: string) => value as "active" | "inactive" | "removed",
    placeholder: "STATUS",
  }
}

function applicationTypeFlag() {
  return {
    brief: "Application type",
    kind: "parsed" as const,
    parse: (value: string) => value as "oidc" | "api" | "saml",
    placeholder: "TYPE",
  }
}
