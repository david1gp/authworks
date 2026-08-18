import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { projectApiClientCreate } from "../client/projectApiClientCreate.js"

type ProjectCliFlags = {
  readonly server?: string
  readonly token?: string
}
type ProjectListCliFlags = ProjectCliFlags & {
  readonly pageSize?: string
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type ProjectIdCliFlags = ProjectCliFlags & { readonly projectId: string; readonly realmId?: string }

const projectCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectCliFlags & { name: string; organizationId?: string; realmId?: string },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    const organizationId = scopeIdResolve(this, flags.organizationId, "organization")
    if (realmId === undefined || organizationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectCreate(realmId, {
        authorizationRequired: false,
        name: flags.name,
        organizationId,
        projectAccessRequired: false,
      }),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectList(realmId, projectListQueryCreate(flags)),
    )
  },
  parameters: { flags: { ...projectCommonFlags(), ...projectListFlags(), realmId: projectScopeIdFlag("Realm UUID") } },
  docs: { brief: "List projects" },
})

const projectGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(this, await projectCliClientCreate(this, flags).projectGet(realmId, flags.projectId))
  },
  parameters: {
    flags: { ...projectCommonFlags(), realmId: projectScopeIdFlag("Realm UUID"), projectId: idFlag("Project UUID") },
  },
  docs: { brief: "Get a project" },
})

const projectUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { name: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectUpdate(realmId, flags.projectId, { name: flags.name }),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectLifecycleSet(realmId, flags.projectId, {
        status: flags.status,
      }),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectApplicationCreate(realmId, flags.projectId, {
        applicationType: flags.applicationType,
        name: flags.name,
      }),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectApplicationList(
        realmId,
        flags.projectId,
        projectListQueryCreate(flags),
      ),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectRoleCreate(realmId, flags.projectId, {
        displayName: flags.displayName,
        key: flags.key,
      }),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectRoleList(
        realmId,
        flags.projectId,
        projectListQueryCreate(flags),
      ),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    const grantedOrganizationId = scopeIdResolve(this, flags.grantedOrganizationId, "organization")
    if (realmId === undefined || grantedOrganizationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectGrantCreate(realmId, flags.projectId, {
        grantedOrganizationId,
        roleKeys: flags.roleKeys.length === 0 ? [] : flags.roleKeys.split(","),
      }),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectGrantList(
        realmId,
        flags.projectId,
        projectListQueryCreate(flags),
      ),
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

function projectCliClientCreate(context: ApplicationContext, flags: ProjectCliFlags) {
  return projectApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.AUTHWORKS_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.AUTHWORKS_TOKEN,
  })
}

function projectCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; success: boolean },
) {
  if (!result.success) {
    context.process.stderr.write(`${result.errorMessage ?? "The request failed."}\n`)
    context.process.exitCode = 1
    return
  }
  context.process.stdout.write(`${JSON.stringify(result.data)}\n`)
}

function projectCommonFlags() {
  return {
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
