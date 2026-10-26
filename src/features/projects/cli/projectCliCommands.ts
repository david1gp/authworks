import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import * as v from "valibot"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { authworksLocalCredentialLookup } from "../../centralConfiguration/public/index.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { projectApiClientCreate } from "../client/projectApiClientCreate.js"
import type { ProjectListQuery } from "../public/projectListQuerySchema.js"

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
type ProjectListFilterCliFlags = ProjectListCliFlags & {
  readonly grantedToOrganizationId?: string
  readonly organizationId?: string
}
type ProjectIdCliFlags = ProjectCliFlags & { readonly projectId?: string; readonly realmId?: string }
type ProjectApplicationIdCliFlags = ProjectIdCliFlags & { readonly applicationId?: string }
type ProjectGrantIdCliFlags = ProjectIdCliFlags & { readonly grantId?: string }
type ProjectRoleIdCliFlags = ProjectIdCliFlags & { readonly roleId?: string }
type ProjectGetCliFlags = ProjectIdCliFlags & { readonly ifModifiedSince?: string }
type ProjectUserAssignmentCliFlags = ProjectIdCliFlags & { readonly assignmentId: string }

const projectCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectCliFlags & {
      authorizationRequired?: boolean
      name: string
      organizationId?: string
      projectAccessRequired?: boolean
      realmId?: string
    },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const organizationId = scopeIdResolve(this, connection.data.organizationId, "organization")
    if (realmId === undefined || organizationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectCreate(realmId, {
        ...(flags.authorizationRequired === undefined ? {} : { authorizationRequired: flags.authorizationRequired }),
        name: flags.name,
        organizationId,
        ...(flags.projectAccessRequired === undefined ? {} : { projectAccessRequired: flags.projectAccessRequired }),
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
      authorizationRequired: {
        brief: "Require a project authorization for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
      projectAccessRequired: {
        brief: "Require a project role for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
    },
  },
  docs: { brief: "Create a project" },
})

const projectListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListFilterCliFlags & { realmId?: string }) {
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
  parameters: {
    flags: {
      ...projectCommonFlags(),
      ...projectListFlags(),
      organizationId: { ...projectScopeIdFlag("Organization filter UUID"), optional: true as const },
      grantedToOrganizationId: {
        ...projectScopeIdFlag("Granted-to organization filter UUID"),
        optional: true as const,
      },
      realmId: projectScopeIdFlag("Realm UUID"),
    },
  },
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
  async func(
    this: ApplicationContext,
    flags: ProjectIdCliFlags & {
      authorizationRequired?: boolean
      name: string
      projectAccessRequired?: boolean
    },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectUpdate(realmId, projectId, {
        ...(flags.authorizationRequired === undefined ? {} : { authorizationRequired: flags.authorizationRequired }),
        name: flags.name,
        ...(flags.projectAccessRequired === undefined ? {} : { projectAccessRequired: flags.projectAccessRequired }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      name: textFlag("Project name"),
      authorizationRequired: {
        brief: "Require a project authorization for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
      projectAccessRequired: {
        brief: "Require a project role for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
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

const projectDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(this, await projectCliClientCreate(connection.data).projectDelete(realmId, projectId), [
      connection.data.token,
      connection.data.systemToken,
    ])
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "Delete a project" },
})

const projectApplicationGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectApplicationIdCliFlags & { ifModifiedSince?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationGet(
        realmId,
        projectId,
        applicationId,
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
      applicationId: applicationScopeIdFlag("Application UUID"),
      ifModifiedSince: ifModifiedSinceFlag(),
    },
  },
  docs: { brief: "Get a project application" },
})

const projectApplicationUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectApplicationIdCliFlags & { name?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationUpdate(realmId, projectId, applicationId, {
        ...(flags.name === undefined ? {} : { name: flags.name }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      applicationId: applicationScopeIdFlag("Application UUID"),
      name: { ...textFlag("Application name"), optional: true as const },
    },
  },
  docs: { brief: "Update a project application" },
})

const projectApplicationDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectApplicationIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationDelete(realmId, projectId, applicationId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      applicationId: applicationScopeIdFlag("Application UUID"),
    },
  },
  docs: { brief: "Delete a project application" },
})

const projectApplicationLifecycleCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectApplicationIdCliFlags & { status: "active" | "inactive" | "removed" },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectApplicationLifecycleSet(realmId, projectId, applicationId, {
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
      applicationId: applicationScopeIdFlag("Application UUID"),
      status: statusFlag(),
    },
  },
  docs: { brief: "Change a project application lifecycle status" },
})

const projectGrantUpdateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectGrantIdCliFlags & { grantedOrganizationId?: string; roleKeys?: string },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const grantId = projectGrantIdResolve(this, flags.grantId)
    if (realmId === undefined || projectId === undefined || grantId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGrantUpdate(realmId, projectId, grantId, {
        ...(flags.grantedOrganizationId === undefined ? {} : { grantedOrganizationId: flags.grantedOrganizationId }),
        ...(flags.roleKeys === undefined ? {} : { roleKeys: projectUserAssignmentRoleKeysParse(flags.roleKeys) }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      grantId: grantScopeIdFlag("Grant UUID"),
      grantedOrganizationId: {
        ...projectScopeIdFlag("Granted organization UUID"),
        optional: true as const,
      },
      roleKeys: { ...textFlag("Comma-separated project role keys; empty clears roles"), optional: true as const },
    },
  },
  docs: { brief: "Update a project grant" },
})

const projectGrantDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectGrantIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const grantId = projectGrantIdResolve(this, flags.grantId)
    if (realmId === undefined || projectId === undefined || grantId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGrantDelete(realmId, projectId, grantId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      grantId: grantScopeIdFlag("Grant UUID"),
    },
  },
  docs: { brief: "Delete a project grant" },
})

const projectGrantLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectGrantIdCliFlags & { status: "active" | "inactive" | "removed" }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const grantId = projectGrantIdResolve(this, flags.grantId)
    if (realmId === undefined || projectId === undefined || grantId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectGrantLifecycleSet(realmId, projectId, grantId, {
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
      grantId: grantScopeIdFlag("Grant UUID"),
      status: statusFlag(),
    },
  },
  docs: { brief: "Change a project grant lifecycle status" },
})

const projectRoleUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectRoleIdCliFlags & { displayName?: string; group?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const roleId = projectRoleIdResolve(this, flags.roleId)
    if (realmId === undefined || projectId === undefined || roleId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectRoleUpdate(realmId, projectId, roleId, {
        ...(flags.displayName === undefined ? {} : { displayName: flags.displayName }),
        ...(flags.group === undefined ? {} : { group: flags.group }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      roleId: roleScopeIdFlag("Role UUID"),
      displayName: { ...textFlag("Role display name"), optional: true as const },
      group: { ...textFlag("Role group"), optional: true as const },
    },
  },
  docs: { brief: "Update a project role" },
})

const projectRoleDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectRoleIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const roleId = projectRoleIdResolve(this, flags.roleId)
    if (realmId === undefined || projectId === undefined || roleId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectRoleDelete(realmId, projectId, roleId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      roleId: roleScopeIdFlag("Role UUID"),
    },
  },
  docs: { brief: "Delete a project role" },
})

const projectTenantCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectCliFlags & {
      authorizationRequired?: boolean
      name: string
      organizationId?: string
      projectAccessRequired?: boolean
      realmId?: string
    },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const organizationId = scopeIdResolve(this, connection.data.organizationId, "organization")
    if (realmId === undefined || organizationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantCreate(realmId, {
        ...(flags.authorizationRequired === undefined ? {} : { authorizationRequired: flags.authorizationRequired }),
        name: flags.name,
        organizationId,
        ...(flags.projectAccessRequired === undefined ? {} : { projectAccessRequired: flags.projectAccessRequired }),
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
      authorizationRequired: {
        brief: "Require a project authorization for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
      projectAccessRequired: {
        brief: "Require a project role for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
    },
  },
  docs: { brief: "Create a tenant project" },
})

const projectTenantListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListFilterCliFlags & { realmId?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantList(realmId, projectListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      ...projectListFlags(),
      organizationId: { ...projectScopeIdFlag("Organization filter UUID"), optional: true as const },
      grantedToOrganizationId: {
        ...projectScopeIdFlag("Granted-to organization filter UUID"),
        optional: true as const,
      },
      realmId: projectScopeIdFlag("Realm UUID"),
    },
  },
  docs: { brief: "List tenant projects" },
})

const projectTenantGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectGetCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantGet(
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
  docs: { brief: "Get a tenant project" },
})

const projectTenantUpdateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectIdCliFlags & {
      authorizationRequired?: boolean
      name: string
      projectAccessRequired?: boolean
    },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantUpdate(realmId, projectId, {
        ...(flags.authorizationRequired === undefined ? {} : { authorizationRequired: flags.authorizationRequired }),
        name: flags.name,
        ...(flags.projectAccessRequired === undefined ? {} : { projectAccessRequired: flags.projectAccessRequired }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      name: textFlag("Project name"),
      authorizationRequired: {
        brief: "Require a project authorization for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
      projectAccessRequired: {
        brief: "Require a project role for OIDC login",
        kind: "boolean" as const,
        optional: true as const,
      },
    },
  },
  docs: { brief: "Rename a tenant project" },
})

const projectTenantLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { status: "active" | "inactive" | "removed" }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantLifecycleSet(realmId, projectId, {
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
  docs: { brief: "Change a tenant project lifecycle status" },
})

const projectTenantDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(this, await projectCliClientCreate(connection.data).projectTenantDelete(realmId, projectId), [
      connection.data.token,
      connection.data.systemToken,
    ])
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "Delete a tenant project" },
})

const projectTenantApplicationCreateCommand = buildCommand({
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
      await projectCliClientCreate(connection.data).projectTenantApplicationCreate(realmId, projectId, {
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
  docs: { brief: "Create a tenant application" },
})

const projectTenantApplicationListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantApplicationList(
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
  docs: { brief: "List tenant applications" },
})

const projectTenantApplicationGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectApplicationIdCliFlags & { ifModifiedSince?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantApplicationGet(
        realmId,
        projectId,
        applicationId,
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
      applicationId: applicationScopeIdFlag("Application UUID"),
      ifModifiedSince: ifModifiedSinceFlag(),
    },
  },
  docs: { brief: "Get a tenant project application" },
})

const projectTenantApplicationUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectApplicationIdCliFlags & { name?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantApplicationUpdate(realmId, projectId, applicationId, {
        ...(flags.name === undefined ? {} : { name: flags.name }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      applicationId: applicationScopeIdFlag("Application UUID"),
      name: { ...textFlag("Application name"), optional: true as const },
    },
  },
  docs: { brief: "Update a tenant project application" },
})

const projectTenantApplicationDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectApplicationIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantApplicationDelete(realmId, projectId, applicationId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      applicationId: applicationScopeIdFlag("Application UUID"),
    },
  },
  docs: { brief: "Delete a tenant project application" },
})

const projectTenantApplicationLifecycleCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectApplicationIdCliFlags & { status: "active" | "inactive" | "removed" },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const applicationId = projectApplicationIdResolve(this, flags.applicationId)
    if (realmId === undefined || projectId === undefined || applicationId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantApplicationLifecycleSet(
        realmId,
        projectId,
        applicationId,
        {
          status: flags.status,
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
      applicationId: applicationScopeIdFlag("Application UUID"),
      status: statusFlag(),
    },
  },
  docs: { brief: "Change a tenant project application lifecycle status" },
})

const projectTenantRoleCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags & { key: string; displayName: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantRoleCreate(realmId, projectId, {
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
  docs: { brief: "Create a tenant project role" },
})

const projectTenantRoleListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantRoleList(
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
  docs: { brief: "List tenant project roles" },
})

const projectTenantRoleUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectRoleIdCliFlags & { displayName?: string; group?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const roleId = projectRoleIdResolve(this, flags.roleId)
    if (realmId === undefined || projectId === undefined || roleId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantRoleUpdate(realmId, projectId, roleId, {
        ...(flags.displayName === undefined ? {} : { displayName: flags.displayName }),
        ...(flags.group === undefined ? {} : { group: flags.group }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      roleId: roleScopeIdFlag("Role UUID"),
      displayName: { ...textFlag("Role display name"), optional: true as const },
      group: { ...textFlag("Role group"), optional: true as const },
    },
  },
  docs: { brief: "Update a tenant project role" },
})

const projectTenantRoleDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectRoleIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const roleId = projectRoleIdResolve(this, flags.roleId)
    if (realmId === undefined || projectId === undefined || roleId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantRoleDelete(realmId, projectId, roleId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      roleId: roleScopeIdFlag("Role UUID"),
    },
  },
  docs: { brief: "Delete a tenant project role" },
})

const projectTenantGrantCreateCommand = buildCommand({
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
      await projectCliClientCreate(connection.data).projectTenantGrantCreate(realmId, projectId, {
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
  docs: { brief: "Create a tenant project grant" },
})

const projectTenantGrantListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantGrantList(
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
  docs: { brief: "List tenant project grants" },
})

const projectTenantGrantUpdateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ProjectGrantIdCliFlags & { grantedOrganizationId?: string; roleKeys?: string },
  ) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const grantId = projectGrantIdResolve(this, flags.grantId)
    if (realmId === undefined || projectId === undefined || grantId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantGrantUpdate(realmId, projectId, grantId, {
        ...(flags.grantedOrganizationId === undefined ? {} : { grantedOrganizationId: flags.grantedOrganizationId }),
        ...(flags.roleKeys === undefined ? {} : { roleKeys: projectUserAssignmentRoleKeysParse(flags.roleKeys) }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      grantId: grantScopeIdFlag("Grant UUID"),
      grantedOrganizationId: {
        ...projectScopeIdFlag("Granted organization UUID"),
        optional: true as const,
      },
      roleKeys: { ...textFlag("Comma-separated project role keys; empty clears roles"), optional: true as const },
    },
  },
  docs: { brief: "Update a tenant project grant" },
})

const projectTenantGrantDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectGrantIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const grantId = projectGrantIdResolve(this, flags.grantId)
    if (realmId === undefined || projectId === undefined || grantId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantGrantDelete(realmId, projectId, grantId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
      grantId: grantScopeIdFlag("Grant UUID"),
    },
  },
  docs: { brief: "Delete a tenant project grant" },
})

const projectTenantGrantLifecycleCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectGrantIdCliFlags & { status: "active" | "inactive" | "removed" }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    const grantId = projectGrantIdResolve(this, flags.grantId)
    if (realmId === undefined || projectId === undefined || grantId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantGrantLifecycleSet(realmId, projectId, grantId, {
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
      grantId: grantScopeIdFlag("Grant UUID"),
      status: statusFlag(),
    },
  },
  docs: { brief: "Change a tenant project grant lifecycle status" },
})

const projectTenantUserAssignmentCreateCommand = buildCommand({
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
      await projectCliClientCreate(connection.data).projectTenantUserAssignmentCreate(realmId, projectId, {
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
  docs: { brief: "Assign a user to a tenant project" },
})

const projectTenantUserAssignmentListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectListCliFlags & ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantUserAssignmentList(
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
  docs: { brief: "List tenant project user assignments" },
})

const projectTenantUserAssignmentUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectUserAssignmentCliFlags & { roleKeys?: string }) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantUserAssignmentUpdate(
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
  docs: { brief: "Update a tenant project user assignment" },
})

const projectTenantUserAssignmentRemoveCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectUserAssignmentCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantUserAssignmentRemove(
        realmId,
        projectId,
        flags.assignmentId,
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
    },
  },
  docs: { brief: "Remove a tenant project user assignment" },
})

const projectTenantAccessCheckCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(
      this,
      await projectCliClientCreate(connection.data).projectTenantAccessCheck(realmId, projectId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "Check tenant project access" },
})

const projectAccessCheckCommand = buildCommand({
  async func(this: ApplicationContext, flags: ProjectIdCliFlags) {
    const connection = await projectCliConnectionResolve(this, flags)
    if (!connection.success) return projectCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const projectId = projectIdResolve(this, connection.data.projectId)
    if (realmId === undefined || projectId === undefined) return
    projectCliResultWrite(this, await projectCliClientCreate(connection.data).projectAccessCheck(realmId, projectId), [
      connection.data.token,
      connection.data.systemToken,
    ])
  },
  parameters: {
    flags: {
      ...projectCommonFlags(),
      realmId: projectScopeIdFlag("Realm UUID"),
      projectId: projectScopeIdFlag("Project UUID"),
    },
  },
  docs: { brief: "Check project access" },
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
    accessCheck: projectAccessCheckCommand,
    assignmentCreate: projectUserAssignmentCreateCommand,
    assignmentList: projectUserAssignmentListCommand,
    assignmentRemove: projectUserAssignmentRemoveCommand,
    assignmentUpdate: projectUserAssignmentUpdateCommand,
    applicationCreate: projectApplicationCreateCommand,
    applicationDelete: projectApplicationDeleteCommand,
    applicationGet: projectApplicationGetCommand,
    applicationLifecycle: projectApplicationLifecycleCommand,
    applicationList: projectApplicationListCommand,
    applicationUpdate: projectApplicationUpdateCommand,
    create: projectCreateCommand,
    delete: projectDeleteCommand,
    get: projectGetCommand,
    grantCreate: projectGrantCreateCommand,
    grantDelete: projectGrantDeleteCommand,
    grantLifecycle: projectGrantLifecycleCommand,
    grantList: projectGrantListCommand,
    grantUpdate: projectGrantUpdateCommand,
    lifecycle: projectLifecycleCommand,
    list: projectListCommand,
    roleCreate: projectRoleCreateCommand,
    roleDelete: projectRoleDeleteCommand,
    roleList: projectRoleListCommand,
    roleUpdate: projectRoleUpdateCommand,
    tenantAccessCheck: projectTenantAccessCheckCommand,
    tenantApplicationCreate: projectTenantApplicationCreateCommand,
    tenantApplicationDelete: projectTenantApplicationDeleteCommand,
    tenantApplicationGet: projectTenantApplicationGetCommand,
    tenantApplicationLifecycle: projectTenantApplicationLifecycleCommand,
    tenantApplicationList: projectTenantApplicationListCommand,
    tenantApplicationUpdate: projectTenantApplicationUpdateCommand,
    tenantAssignmentCreate: projectTenantUserAssignmentCreateCommand,
    tenantAssignmentList: projectTenantUserAssignmentListCommand,
    tenantAssignmentRemove: projectTenantUserAssignmentRemoveCommand,
    tenantAssignmentUpdate: projectTenantUserAssignmentUpdateCommand,
    tenantCreate: projectTenantCreateCommand,
    tenantDelete: projectTenantDeleteCommand,
    tenantGet: projectTenantGetCommand,
    tenantGrantCreate: projectTenantGrantCreateCommand,
    tenantGrantDelete: projectTenantGrantDeleteCommand,
    tenantGrantLifecycle: projectTenantGrantLifecycleCommand,
    tenantGrantList: projectTenantGrantListCommand,
    tenantGrantUpdate: projectTenantGrantUpdateCommand,
    tenantLifecycle: projectTenantLifecycleCommand,
    tenantList: projectTenantListCommand,
    tenantRoleCreate: projectTenantRoleCreateCommand,
    tenantRoleDelete: projectTenantRoleDeleteCommand,
    tenantRoleList: projectTenantRoleListCommand,
    tenantRoleUpdate: projectTenantRoleUpdateCommand,
    tenantUpdate: projectTenantUpdateCommand,
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

function projectListQueryCreate(flags: ProjectListFilterCliFlags): ProjectListQuery | undefined {
  if (
    flags.organizationId === undefined &&
    flags.grantedToOrganizationId === undefined &&
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined
  )
    return undefined
  return {
    ...(flags.organizationId === undefined ? {} : { organizationId: flags.organizationId }),
    ...(flags.grantedToOrganizationId === undefined ? {} : { grantedToOrganizationId: flags.grantedToOrganizationId }),
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

function projectApplicationIdResolve(
  context: ApplicationContext,
  applicationId: string | undefined,
): string | undefined {
  if (applicationId !== undefined && applicationId.trim().length > 0) return applicationId
  context.process.stderr.write("Expected input for flag --application-id\n")
  context.process.exitCode = 1
  return undefined
}

function projectGrantIdResolve(context: ApplicationContext, grantId: string | undefined): string | undefined {
  if (grantId !== undefined && grantId.trim().length > 0) return grantId
  context.process.stderr.write("Expected input for flag --grant-id\n")
  context.process.exitCode = 1
  return undefined
}

function projectRoleIdResolve(context: ApplicationContext, roleId: string | undefined): string | undefined {
  if (roleId !== undefined && roleId.trim().length > 0) return roleId
  context.process.stderr.write("Expected input for flag --role-id\n")
  context.process.exitCode = 1
  return undefined
}

function applicationScopeIdFlag(brief: string) {
  return { ...idFlag(brief), optional: true as const }
}

function grantScopeIdFlag(brief: string) {
  return { ...idFlag(brief), optional: true as const }
}

function roleScopeIdFlag(brief: string) {
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
