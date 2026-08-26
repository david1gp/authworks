import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { projectApiClientCreate } from "../client/projectApiClientCreate.js"

type ProjectCliFlags = {
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
type ProjectIdCliFlags = ProjectCliFlags & { readonly projectId: string; readonly realmId?: string }
type ProjectGetCliFlags = ProjectIdCliFlags & { readonly ifModifiedSince?: string }

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
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGet(
        realmId,
        flags.projectId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: idFlag("Project UUID"),
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
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectUpdate(realmId, flags.projectId, { name: flags.name }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: idFlag("Project UUID"),
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
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectLifecycleSet(realmId, flags.projectId, {
        status: flags.status,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: idFlag("Project UUID"),
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
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationCreate(realmId, flags.projectId, {
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
      projectId: idFlag("Project UUID"),
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
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationList(
        realmId,
        flags.projectId,
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
      projectId: idFlag("Project UUID"),
    },
  },
  docs: { brief: "List applications" },
})

const projectRoleCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { key: string; displayName: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectRoleCreate(realmId, flags.projectId, {
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
      projectId: idFlag("Project UUID"),
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
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectRoleList(
        realmId,
        flags.projectId,
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
      projectId: idFlag("Project UUID"),
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
    const grantedOrganizationId = scopeIdResolve(this, connection.data.organizationId, "organization")
    if (realmId === undefined || grantedOrganizationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGrantCreate(realmId, flags.projectId, {
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
      projectId: idFlag("Project UUID"),
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
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGrantList(
        realmId,
        flags.projectId,
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
      projectId: idFlag("Project UUID"),
    },
  },
  docs: { brief: "List project grants" },
})

export const projectCliCommands = buildRouteMap({
  routes: {
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
  docs: { brief: "Project, application, role, and grant administration" },
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
    profile: connectionProfileCliProfileFlag(),
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

function idFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "UUID" }
}

function projectScopeIdFlag(brief: string) {
  return { ...idFlag(brief), optional: true as const }
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
