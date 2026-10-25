import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ConfirmRequest } from "../../../ui/confirm/confirmStateCreate.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectAccessResponse } from "../public/projectAccessResponseSchema.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import type { ProjectListItem } from "../public/projectListItemSchema.js"
import type { ProjectListQuery } from "../public/projectListQuerySchema.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import type { Project } from "../public/projectSchema.js"
import type { ProjectUserAssignment } from "../public/projectUserAssignmentSchema.js"
import type { ProjectAdminAdapter } from "./projectAdminAdapter.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"
import type { ProjectAdminStatus } from "./projectAdminStatusSchema.js"

type ProjectAdminOrganization = { readonly id: string; readonly name: string }
type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

type ProjectAdminPageStateCreateOptions = {
  readonly adapter: ProjectAdminAdapter
  readonly confirm: (request: ConfirmRequest) => boolean | Promise<boolean>
  readonly listSearch?: () => string
  readonly listStatus?: () => ProjectListQuery["status"]
  readonly organizationId: () => string | undefined
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
  const projects = createSignalObject<readonly ProjectListItem[]>([])
  const project = createSignalObject<Project | undefined>(undefined)
  const applications = createSignalObject<readonly ProjectApplication[]>([])
  const assignments = createSignalObject<readonly ProjectUserAssignment[]>([])
  const grants = createSignalObject<readonly ProjectGrant[]>([])
  const roles = createSignalObject<readonly ProjectRole[]>([])
  const organizations = createSignalObject<readonly ProjectAdminOrganization[]>([])
  const access = createSignalObject<ProjectAccessResponse | undefined>(undefined)
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<readonly string[]>([])

  const fail = (result: FailedResult) => {
    error.set(result.errorMessage)
    if (result.statusCode === 403 || result.code?.endsWith(".forbidden")) return status.set("permission-denied")
    if (result.code?.endsWith(".tenant-mismatch")) return status.set("cross-tenant")
    status.set("error")
  }

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    const screen = options.screen()
    const currentProjectId = options.projectId()

    if (screen === "projects") {
      const search = options.listSearch?.().trim() ?? ""
      const pageToken = pageTokens.get().at(-1)
      const [listed, organizationList] = await Promise.all([
        adapter.projectList({
          organizationId: options.organizationId(),
          ...(search.length === 0 ? {} : { search }),
          ...(options.listStatus?.() === undefined ? {} : { status: options.listStatus?.() }),
          ...(pageToken === undefined ? {} : { pageToken }),
        }),
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

    const [current, applicationList, assignmentList, grantList, roleList, accessCheck, organizationList] =
      await Promise.all([
        adapter.projectGet(currentProjectId),
        adapter.applicationList(currentProjectId),
        adapter.assignmentList(currentProjectId),
        adapter.grantList(currentProjectId),
        adapter.roleList(currentProjectId),
        adapter.projectAccessCheck(currentProjectId),
        adapter.organizations(),
      ])
    if (!current.success) return fail(current)
    if (!applicationList.success) return fail(applicationList)
    if (!assignmentList.success) return fail(assignmentList)
    if (!grantList.success) return fail(grantList)
    if (!roleList.success) return fail(roleList)
    if (!accessCheck.success) return fail(accessCheck)
    if (organizationList.success) organizations.set(organizationList.data)
    project.set(current.data)
    applications.set(applicationList.data.items)
    assignments.set(assignmentList.data.items)
    grants.set(grantList.data.items)
    roles.set(roleList.data.items)
    access.set(accessCheck.data)
    status.set("ready")
  }

  // Every destructive guard awaits the same in-app prompt, so cancel is always non-destructive.
  // A guard may name the action so the prompt is project-specific rather than generic.
  const confirmed = async (
    key: MessageKey,
    labels?: { readonly acceptKey: MessageKey; readonly titleKey: MessageKey },
  ) =>
    (await options.confirm({
      message: messageTranslate(key),
      ...(labels === undefined
        ? {}
        : { acceptLabel: messageTranslate(labels.acceptKey), title: messageTranslate(labels.titleKey) }),
    })) === true

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

  // A new search or status filter always restarts from the first page; otherwise the
  // cursor of the previous filter would page through the new result set.
  const listSignature = () => `${options.listSearch?.() ?? ""}:${options.listStatus?.() ?? ""}`
  const appliedListSignature = createSignalObject("")
  createEffect(
    on(
      () =>
        `${options.screen()}:${options.projectId() ?? ""}:${options.organizationId() ?? ""}:${pageTokens.get().length}:${listSignature()}`,
      () => {
        if (options.screen() === "projects" && appliedListSignature.get() !== listSignature()) {
          appliedListSignature.set(listSignature())
          if (pageTokens.get().length > 0) {
            pageTokens.set([])
            return
          }
        }
        void load()
      },
    ),
  )

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
    assignmentCreate: async (projectId: string, userId: string, roleKeys: readonly string[]) => {
      const created = await mutate("assignment:create", () =>
        adapter.assignmentCreate(projectId, { roleKeys: [...roleKeys], userId }),
      )
      if (created === undefined) return false
      assignments.set([...assignments.get(), created])
      notice.set(created.userId)
      status.set("ready")
      return true
    },
    assignmentRemove: async (projectId: string, assignmentId: string) => {
      if (!(await confirmed("admin.projects.assignments.removeConfirm"))) return
      const removed = await mutate(`assignment:${assignmentId}`, () =>
        adapter.assignmentRemove(projectId, assignmentId),
      )
      if (removed === undefined) return
      assignments.set(assignments.get().filter((item) => item.id !== assignmentId))
      notice.set(assignmentId)
    },
    assignmentUpdate: async (projectId: string, assignmentId: string, roleKeys: readonly string[]) => {
      const updated = await mutate(`assignment:${assignmentId}`, () =>
        adapter.assignmentUpdate(projectId, assignmentId, { roleKeys: [...roleKeys] }),
      )
      if (updated === undefined) return false
      assignments.set(assignments.get().map((item) => (item.id === assignmentId ? updated : item)))
      notice.set(updated.userId)
      return true
    },
    assignments: assignments.get,
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
      projects.set([...projects.get(), { ...created }])
      notice.set(created.name)
      status.set("ready")
      return true
    },
    projectDelete: async (projectId: string) => {
      const accepted = await confirmed("admin.projects.deleteConfirm", {
        acceptKey: "admin.projects.deleteConfirmAccept",
        titleKey: "admin.projects.deleteConfirmTitle",
      })
      if (!accepted) return false
      const deleted = await mutate(`project:${projectId}`, () => adapter.projectDelete(projectId))
      if (deleted === undefined) return false
      projects.set(projects.get().filter((item) => item.id !== projectId))
      return true
    },
    projectLifecycleSet: async (projectId: string, nextStatus: "active" | "inactive" | "removed") => {
      if (
        nextStatus === "removed" &&
        !(await confirmed("admin.projects.lifecycle.removeConfirm", {
          acceptKey: "admin.projects.lifecycle.removeConfirmAccept",
          titleKey: "admin.projects.lifecycle.removeConfirmTitle",
        }))
      ) {
        return
      }
      const updated = await mutate(`project:${projectId}`, () =>
        adapter.projectLifecycleSet(projectId, { status: nextStatus }),
      )
      if (updated === undefined) return
      project.set(updated)
      projects.set(projects.get().map((item) => (item.id === projectId ? { ...updated } : item)))
      notice.set(updated.name)
    },
    projectOwned: () => {
      const current = project.get()
      if (current === undefined) return true
      return current.organizationId === options.organizationId()
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
