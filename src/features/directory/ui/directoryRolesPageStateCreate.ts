import { createEffect, on } from "solid-js"
import * as v from "valibot"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ConfirmRequest } from "../../../ui/confirm/confirmStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationRole } from "../../organizations/public/organizationRoleSchema.js"
import type { ProjectRoleCreateRequest } from "../../projects/public/projectRoleCreateRequestSchema.js"
import type { ProjectRole } from "../../projects/public/projectRoleSchema.js"
import type { ProjectRoleUpdateRequest } from "../../projects/public/projectRoleUpdateRequestSchema.js"
import type { DirectoryOrganizationUserSummary } from "../public/directoryOrganizationUserSummarySchema.js"
import type { DirectoryRolesAdapter, DirectoryRolesProjectEntry } from "./directoryRolesAdapter.js"
import { type DirectoryRolesCache, directoryRolesCacheSchema } from "./directoryRolesCacheSchema.js"

export type DirectoryRolesStatus = "loading" | "ready" | "empty" | "error" | "permission-denied" | "cross-tenant"

/**
 * Adapter-agnostic roles page state: organization summary plus every project of
 * the active organization with its roles. The last successful response is
 * cached per realm and organization so reloads render instantly, then refresh.
 */
export function directoryRolesPageStateCreate(options: {
  readonly adapter: DirectoryRolesAdapter
  readonly cacheKey: () => string
  readonly canManage: () => boolean
  readonly confirm: (request: ConfirmRequest) => boolean | Promise<boolean>
  readonly organizationId: () => string
}) {
  const status = createSignalObject<DirectoryRolesStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const summary = createSignalObject<DirectoryOrganizationUserSummary | undefined>(undefined)
  const organizationRoles = createSignalObject<readonly OrganizationRole[]>([])
  const entries = createSignalObject<readonly DirectoryRolesProjectEntry[]>([])
  const organizationId = () => options.organizationId()

  const cacheRead = (): DirectoryRolesCache | undefined => {
    if (typeof localStorage === "undefined") return undefined
    try {
      const raw = localStorage.getItem(options.cacheKey())
      if (raw === null) return undefined
      const parsed = v.safeParse(directoryRolesCacheSchema, JSON.parse(raw))
      return parsed.success ? parsed.output : undefined
    } catch {
      return undefined
    }
  }
  const cacheWrite = (cached: DirectoryRolesCache) => {
    if (typeof localStorage === "undefined") return
    try {
      localStorage.setItem(options.cacheKey(), JSON.stringify(cached))
    } catch {
      // Browsers may block storage; the page simply reloads from the network.
    }
  }

  const fail = (failure: { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }) => {
    error.set(failure.errorMessage)
    if (failure.statusCode === 403 || failure.code?.endsWith(".forbidden")) return status.set("permission-denied")
    if (failure.code?.endsWith(".tenant-mismatch")) return status.set("cross-tenant")
    status.set("error")
  }

  const load = async (silent: boolean) => {
    if (!silent) {
      status.set("loading")
      error.set(undefined)
    }
    notice.set(undefined)
    const [summaryResult, roleResult, projectResult] = await Promise.all([
      options.adapter.userSummary(),
      options.adapter.organizationRoleList(),
      options.adapter.projectList(),
    ])
    if (!summaryResult.success) return fail(summaryResult)
    if (!roleResult.success) return fail(roleResult)
    if (!projectResult.success) return fail(projectResult)
    const roleLists = await Promise.all(
      projectResult.data.map(async (project) => options.adapter.projectRoleList(project.id)),
    )
    const failed = roleLists.find((result): result is Extract<typeof result, { success: false }> => !result.success)
    if (failed !== undefined) return fail(failed)
    const loaded: DirectoryRolesProjectEntry[] = []
    for (const [index, project] of projectResult.data.entries()) {
      const roleList = roleLists[index]
      if (roleList === undefined || !roleList.success) {
        if (roleList !== undefined && !roleList.success) return fail(roleList)
        continue
      }
      loaded.push({ owned: project.organizationId === organizationId(), project, roles: roleList.data })
    }
    summary.set(summaryResult.data)
    organizationRoles.set([...roleResult.data])
    const snapshot: DirectoryRolesCache = {
      entries: loaded.map((entry) => ({ ...entry, roles: [...entry.roles] })),
      organizationRoles: [...roleResult.data],
      summary: summaryResult.data,
    }
    entries.set(loaded)
    cacheWrite(snapshot)
    if (loaded.length === 0) return status.set("empty")
    status.set("ready")
  }

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

  const applyCreatedRole = (projectId: string, role: ProjectRole) => {
    entries.set(
      entries.get().map((entry) =>
        entry.project.id === projectId
          ? {
              ...entry,
              project: { ...entry.project, roleCount: entry.roles.length + 1 },
              roles: [...entry.roles, role],
            }
          : entry,
      ),
    )
    status.set("ready")
  }

  createEffect(
    on(
      () => options.cacheKey(),
      () => {
        const cached = cacheRead()
        if (cached !== undefined) {
          summary.set(cached.summary)
          organizationRoles.set(cached.organizationRoles)
          entries.set(cached.entries)
          status.set(cached.entries.length === 0 ? "empty" : "ready")
          void load(true)
          return
        }
        void load(false)
      },
    ),
  )

  return {
    canManage: options.canManage,
    entries: entries.get,
    entry: (projectId: string) => entries.get().find((entry) => entry.project.id === projectId),
    error: error.get,
    memberCount: (roleId: string) => summary.get()?.roles[roleId as keyof DirectoryOrganizationUserSummary["roles"]],
    notice: notice.get,
    organizationId,
    organizationRoles: organizationRoles.get,
    pendingId: pendingId.get,
    reload: () => void load(status.get() === "ready"),
    roleCreate: async (projectId: string, input: ProjectRoleCreateRequest) => {
      const created = await mutate("role:create", () => options.adapter.projectRoleCreate(projectId, input))
      if (created === undefined) return false
      applyCreatedRole(projectId, created)
      notice.set(created.key)
      return true
    },
    roleDelete: async (projectId: string, roleId: string) => {
      const confirmed = await options.confirm({
        acceptLabel: messageTranslate("admin.roles.projects.deleteConfirmAccept"),
        message: messageTranslate("admin.roles.projects.deleteConfirm"),
        title: messageTranslate("admin.roles.projects.deleteConfirmTitle"),
      })
      if (!confirmed) return
      const deleted = await mutate(`role:${roleId}`, () => options.adapter.projectRoleDelete(projectId, roleId))
      if (deleted === undefined) return
      entries.set(
        entries.get().map((entry) =>
          entry.project.id === projectId
            ? {
                ...entry,
                project: { ...entry.project, roleCount: Math.max(0, entry.roles.length - 1) },
                roles: entry.roles.filter((role) => role.id !== roleId),
              }
            : entry,
        ),
      )
      notice.set(roleId)
    },
    roleUpdate: async (projectId: string, roleId: string, input: ProjectRoleUpdateRequest) => {
      const updated = await mutate(`role:${roleId}`, () => options.adapter.projectRoleUpdate(projectId, roleId, input))
      if (updated === undefined) return false
      entries.set(
        entries
          .get()
          .map((entry) =>
            entry.project.id === projectId
              ? { ...entry, roles: entry.roles.map((role) => (role.id === roleId ? updated : role)) }
              : entry,
          ),
      )
      notice.set(updated.key)
      return true
    },
    status: status.get,
    summary: summary.get,
  }
}

export type DirectoryRolesPageState = ReturnType<typeof directoryRolesPageStateCreate>
