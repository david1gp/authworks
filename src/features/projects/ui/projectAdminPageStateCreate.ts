import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import type { Project } from "../public/projectSchema.js"
import type { ProjectAdminAdapter } from "./projectAdminAdapter.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"
import type { ProjectAdminStatus } from "./projectAdminStatusSchema.js"

type Organization = { readonly id: string; readonly name: string }
type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

type ProjectAdminPageStateCreateOptions = {
  readonly adapter: ProjectAdminAdapter
  readonly confirm: (message: string) => boolean | Promise<boolean>
  readonly projectId: () => string | undefined
  readonly screen: () => ProjectAdminScreen
}

/**
 * Shared, adapter-agnostic state for every project administration screen.
 * Views read only from here, so production and demo render identically.
 */
export function projectAdminPageStateCreate(options: ProjectAdminPageStateCreateOptions) {
  const adapter = options.adapter
  const status = createSignalObject<ProjectAdminStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const projects = createSignalObject<readonly Project[]>([])
  const project = createSignalObject<Project | undefined>(undefined)
  const applications = createSignalObject<readonly ProjectApplication[]>([])
  const grants = createSignalObject<readonly ProjectGrant[]>([])
  const roles = createSignalObject<readonly ProjectRole[]>([])
  const organizations = createSignalObject<readonly Organization[]>([])
  const access = createSignalObject<{ readonly grantedOrganizationId?: string; readonly roleKeys: readonly string[] }>({
    roleKeys: [],
  })
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<readonly string[]>([])

  const fail = (result: FailedResult) => {
    error.set(result.errorMessage)
    if (result.statusCode === 403 || result.code?.endsWith(".forbidden")) return status.set("permission-denied")
    if (result.code?.endsWith(".tenant-mismatch")) return status.set("cross-tenant")
    if (result.statusCode === 404 && options.screen() !== "projects") return status.set("cross-tenant")
    status.set("error")
  }

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    const screen = options.screen()
    const currentProjectId = options.projectId()

    if (screen === "projects") {
      const [listed, organizationList] = await Promise.all([
        adapter.projectList(pageTokens.get().at(-1)),
        adapter.organizations(),
      ])
      if (!listed.success) return fail(listed)
      if (organizationList.success) organizations.set(organizationList.data)
      projects.set(listed.data.items)
      nextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }

    if (currentProjectId === undefined) {
      error.set(messageTranslate("admin.projects.missingId"))
      return status.set("error")
    }

    if (screen === "applications") {
      const [current, listed] = await Promise.all([
        adapter.projectGet(currentProjectId),
        adapter.applicationList(currentProjectId, pageTokens.get().at(-1)),
      ])
      if (!current.success) return fail(current)
      if (!listed.success) return fail(listed)
      project.set(current.data)
      applications.set(listed.data.items)
      nextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }

    if (screen === "roles-grants") {
      const [current, roleList, grantList, organizationList] = await Promise.all([
        adapter.projectGet(currentProjectId),
        adapter.roleList(currentProjectId),
        adapter.grantList(currentProjectId),
        adapter.organizations(),
      ])
      if (!current.success) return fail(current)
      if (!roleList.success) return fail(roleList)
      if (!grantList.success) return fail(grantList)
      if (organizationList.success) organizations.set(organizationList.data)
      project.set(current.data)
      roles.set(roleList.data.items)
      grants.set(grantList.data.items)
      return status.set(roleList.data.items.length === 0 && grantList.data.items.length === 0 ? "empty" : "ready")
    }

    if (screen === "effective-access") {
      const [current, checked] = await Promise.all([
        adapter.projectGet(currentProjectId),
        adapter.projectAccessCheck(currentProjectId),
      ])
      if (!current.success) return fail(current)
      if (!checked.success) return fail(checked)
      project.set(current.data)
      access.set({ grantedOrganizationId: checked.data.grantedOrganizationId, roleKeys: checked.data.roleKeys })
      return status.set(checked.data.roleKeys.length === 0 ? "empty" : "ready")
    }

    const [current, roleList, organizationList] = await Promise.all([
      adapter.projectGet(currentProjectId),
      adapter.roleList(currentProjectId),
      adapter.organizations(),
    ])
    if (!current.success) return fail(current)
    if (!roleList.success) return fail(roleList)
    if (organizationList.success) organizations.set(organizationList.data)
    project.set(current.data)
    roles.set(roleList.data.items)
    status.set("ready")
  }

  // Every destructive guard awaits the same in-app prompt, so cancel is always non-destructive.
  const confirmed = async (key: Parameters<typeof messageTranslate>[0]) =>
    (await options.confirm(messageTranslate(key))) === true

  const mutate = async <T>(id: string, operation: () => Promise<Result<T>>): Promise<T | undefined> => {
    pendingId.set(id)
    error.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (!result.success) {
      fail(result)
      return undefined
    }
    return result.data
  }

  createEffect(on(() => `${options.screen()}:${options.projectId() ?? ""}:${pageTokens.get().length}`, load))

  return {
    access: access.get,
    applicationCreate: async (projectId: string, name: string, applicationType: "api" | "oidc" | "saml") => {
      const created = await mutate("application:create", () =>
        adapter.applicationCreate(projectId, { applicationType, name }),
      )
      if (created === undefined) return false
      applications.set([...applications.get(), created])
      notice.set(created.name)
      status.set("ready")
      return true
    },
    applicationLifecycleSet: async (
      projectId: string,
      applicationId: string,
      nextStatus: "active" | "inactive" | "removed",
    ) => {
      if (nextStatus === "removed" && !(await confirmed("admin.projects.applications.removeConfirm"))) return
      const updated = await mutate(`application:${applicationId}`, () =>
        adapter.applicationLifecycleSet(projectId, applicationId, { status: nextStatus }),
      )
      if (updated === undefined) return
      applications.set(applications.get().map((item) => (item.id === applicationId ? updated : item)))
      notice.set(updated.name)
    },
    applications: applications.get,
    error: error.get,
    grantCreate: async (projectId: string, grantedOrganizationId: string, roleKeys: readonly string[]) => {
      const created = await mutate("grant:create", () =>
        adapter.grantCreate(projectId, { grantedOrganizationId, roleKeys: [...roleKeys] }),
      )
      if (created === undefined) return false
      grants.set([...grants.get(), created])
      notice.set(created.id)
      status.set("ready")
      return true
    },
    grantDelete: async (projectId: string, grantId: string) => {
      if (!(await confirmed("admin.projects.grants.revokeConfirm"))) return
      const deleted = await mutate(`grant:${grantId}`, () => adapter.grantDelete(projectId, grantId))
      if (deleted === undefined) return
      const remaining = grants.get().filter((item) => item.id !== grantId)
      grants.set(remaining)
      notice.set(grantId)
      if (remaining.length === 0 && roles.get().length === 0) status.set("empty")
    },
    grantLifecycleSet: async (projectId: string, grantId: string, nextStatus: "active" | "inactive" | "removed") => {
      const updated = await mutate(`grant:${grantId}`, () =>
        adapter.grantLifecycleSet(projectId, grantId, { status: nextStatus }),
      )
      if (updated === undefined) return
      grants.set(grants.get().map((item) => (item.id === grantId ? updated : item)))
      notice.set(updated.id)
    },
    grants: grants.get,
    hasNextPage: () => nextPageToken.get() !== undefined,
    hasPreviousPage: () => pageTokens.get().length > 0,
    notice: notice.get,
    organizationName: (id: string) => organizations.get().find((item) => item.id === id)?.name ?? id,
    organizations: organizations.get,
    pageNext: () => {
      const token = nextPageToken.get()
      if (token === undefined) return
      pageTokens.set([...pageTokens.get(), token])
    },
    pagePrevious: () => pageTokens.set(pageTokens.get().slice(0, -1)),
    pendingId: pendingId.get,
    permissionRoles: () => adapter.permissionRoles(),
    project: project.get,
    projectCreate: async (name: string, organizationId: string) => {
      const created = await mutate("project:create", () => adapter.projectCreate({ name, organizationId }))
      if (created === undefined) return false
      projects.set([...projects.get(), created])
      notice.set(created.name)
      status.set("ready")
      return true
    },
    projectDelete: async (projectId: string) => {
      if (!(await confirmed("admin.projects.deleteConfirm"))) return false
      const deleted = await mutate(`project:${projectId}`, () => adapter.projectDelete(projectId))
      if (deleted === undefined) return false
      projects.set(projects.get().filter((item) => item.id !== projectId))
      return true
    },
    projectLifecycleSet: async (projectId: string, nextStatus: "active" | "inactive" | "removed") => {
      if (nextStatus === "removed" && !(await confirmed("admin.projects.lifecycle.removeConfirm"))) return
      const updated = await mutate(`project:${projectId}`, () =>
        adapter.projectLifecycleSet(projectId, { status: nextStatus }),
      )
      if (updated === undefined) return
      project.set(updated)
      projects.set(projects.get().map((item) => (item.id === projectId ? updated : item)))
      notice.set(updated.name)
    },
    projects: projects.get,
    projectUpdate: async (
      projectId: string,
      input: {
        readonly authorizationRequired: boolean
        readonly name: string
        readonly projectAccessRequired: boolean
      },
    ) => {
      const updated = await mutate(`project:${projectId}`, () => adapter.projectUpdate(projectId, input))
      if (updated === undefined) return false
      project.set(updated)
      notice.set(updated.name)
      return true
    },
    reload: () => void load(),
    roleCreate: async (projectId: string, key: string, displayName: string, group?: string) => {
      const created = await mutate("role:create", () =>
        adapter.roleCreate(projectId, { displayName, ...(group === undefined ? {} : { group }), key }),
      )
      if (created === undefined) return false
      roles.set([...roles.get(), created])
      notice.set(created.key)
      status.set("ready")
      return true
    },
    roleDelete: async (projectId: string, roleId: string) => {
      if (!(await confirmed("admin.projects.roles.deleteConfirm"))) return
      const deleted = await mutate(`role:${roleId}`, () => adapter.roleDelete(projectId, roleId))
      if (deleted === undefined) return
      const remaining = roles.get().filter((item) => item.id !== roleId)
      roles.set(remaining)
      if (remaining.length === 0 && grants.get().length === 0) status.set("empty")
    },
    roles: roles.get,
    status: status.get,
  }
}

export type ProjectAdminPageState = ReturnType<typeof projectAdminPageStateCreate>
