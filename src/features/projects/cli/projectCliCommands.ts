import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { projectApiClientCreate } from "../client/projectApiClientCreate.js"

type ProjectCliFlags = { readonly server?: string; readonly token?: string }
type ProjectIdCliFlags = ProjectCliFlags & { readonly projectId: string; readonly realmId: string }

const projectCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectCliFlags & { name: string; organizationId: string; realmId: string },
  ) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectCreate(flags.realmId, {
        authorizationRequired: false,
        name: flags.name,
        organizationId: flags.organizationId,
        projectAccessRequired: false,
      }),
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: idFlag("Realm UUID"),
      organizationId: idFlag("Organization UUID"),
      name: textFlag("Project name"),
    },
  },
  docs: { brief: "Create a project" },
})

const projectListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectCliFlags & { realmId: string }) {
    projectCliResultWrite(this, await projectCliClientCreate(this, flags).projectList(flags.realmId))
  },
  parameters: { flags: { ...projectCommonFlags(), realmId: idFlag("Realm UUID") } },
  docs: { brief: "List projects" },
})

const projectGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    projectCliResultWrite(this, await projectCliClientCreate(this, flags).projectGet(flags.realmId, flags.projectId))
  },
  parameters: {
    flags: { ...projectCommonFlags(), realmId: idFlag("Realm UUID"), projectId: idFlag("Project UUID") },
  },
  docs: { brief: "Get a project" },
})

const projectUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { name: string }) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectUpdate(flags.realmId, flags.projectId, { name: flags.name }),
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: idFlag("Realm UUID"),
      projectId: idFlag("Project UUID"),
      name: textFlag("Project name"),
    },
  },
  docs: { brief: "Rename a project" },
})

const projectLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { status: "active" | "inactive" | "removed" }) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectLifecycleSet(flags.realmId, flags.projectId, {
        status: flags.status,
      }),
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: idFlag("Realm UUID"),
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
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectApplicationCreate(flags.realmId, flags.projectId, {
        applicationType: flags.applicationType,
        name: flags.name,
      }),
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: idFlag("Realm UUID"),
      projectId: idFlag("Project UUID"),
      name: textFlag("Application name"),
      applicationType: applicationTypeFlag(),
    },
  },
  docs: { brief: "Create an application" },
})

const projectApplicationListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectApplicationList(flags.realmId, flags.projectId),
    )
  },
  parameters: {
    flags: { ...projectCommonFlags(), realmId: idFlag("Realm UUID"), projectId: idFlag("Project UUID") },
  },
  docs: { brief: "List applications" },
})

const projectRoleCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { key: string; displayName: string }) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectRoleCreate(flags.realmId, flags.projectId, {
        displayName: flags.displayName,
        key: flags.key,
      }),
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: idFlag("Realm UUID"),
      projectId: idFlag("Project UUID"),
      key: textFlag("Role key"),
      displayName: textFlag("Role display name"),
    },
  },
  docs: { brief: "Create a project role" },
})

const projectRoleListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectRoleList(flags.realmId, flags.projectId),
    )
  },
  parameters: {
    flags: { ...projectCommonFlags(), realmId: idFlag("Realm UUID"), projectId: idFlag("Project UUID") },
  },
  docs: { brief: "List project roles" },
})

const projectGrantCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { grantedOrganizationId: string; roleKeys: string }) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectGrantCreate(flags.realmId, flags.projectId, {
        grantedOrganizationId: flags.grantedOrganizationId,
        roleKeys: flags.roleKeys.length === 0 ? [] : flags.roleKeys.split(","),
      }),
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: idFlag("Realm UUID"),
      projectId: idFlag("Project UUID"),
      grantedOrganizationId: idFlag("Granted organization UUID"),
      roleKeys: textFlag("Comma-separated project role keys"),
    },
  },
  docs: { brief: "Create a project grant" },
})

const projectGrantListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    projectCliResultWrite(
      this,
      await projectCliClientCreate(this, flags).projectGrantList(flags.realmId, flags.projectId),
    )
  },
  parameters: {
    flags: { ...projectCommonFlags(), realmId: idFlag("Realm UUID"), projectId: idFlag("Project UUID") },
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
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
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
      brief: "ZITADEL v2 server URL",
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

function idFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "UUID" }
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
