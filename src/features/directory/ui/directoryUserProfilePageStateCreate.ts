import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ConfirmRequest } from "../../../ui/confirm/confirmStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { ProjectRole } from "../../projects/public/projectRoleSchema.js"
import type { ProjectUserAssignment } from "../../projects/public/projectUserAssignmentSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { UserState } from "../../users/public/userStateSchema.js"
import type { DirectoryProjectAssignment } from "../public/directoryUserAccessSchema.js"
import type { DirectoryUserProfile, DirectoryUserProfileAdapter } from "./directoryUserProfileAdapter.js"
import { directoryUserProfilePermissionsResolve } from "./directoryUserProfilePermissions.js"

export type DirectoryUserProfileStatus = "loading" | "ready" | "empty" | "error" | "permission-denied" | "expired"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

type DirectoryUserProfilePageStateCreateOptions = {
  readonly actorOrganizationRoles: () => readonly OrganizationRoleId[]
  readonly actorRealmAdministrator: () => boolean
  /** Renders in-app destructive confirmations; without one destructive actions decline. */
  readonly confirm: (request: ConfirmRequest) => boolean | Promise<boolean>
  readonly organizationId: () => string
  readonly realmId: () => string
  readonly reloadKey?: () => string
  readonly userId: () => string | undefined
}

const failureStatusSelect = (failure: FailedResult): DirectoryUserProfileStatus => {
  if (failure.code === "sessions.unauthorized" || failure.statusCode === 401) return "expired"
  if (failure.code?.endsWith(".forbidden") === true || failure.statusCode === 403) return "permission-denied"
  return "error"
}

/**
 * Adapter-agnostic state for the user profile page: the profile payload, authentication
 * methods, sessions, project roles for the assign dialog, plus every mutation the view
 * offers. Views read only from here, so production and demo render identically.
 */
export function directoryUserProfilePageStateCreate(
  adapter: DirectoryUserProfileAdapter,
  options: DirectoryUserProfilePageStateCreateOptions,
) {
  const status = createSignalObject<DirectoryUserProfileStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const profile = createSignalObject<DirectoryUserProfile | undefined>(undefined)
  const methods = createSignalObject<UserAuthenticationMethods | undefined>(undefined)
  const methodsError = createSignalObject<string | undefined>(undefined)
  const methodsStatus = createSignalObject<"loading" | "ready" | "empty" | "error">("loading")
  const sessions = createSignalObject<readonly Session[]>([])
  const sessionsError = createSignalObject<string | undefined>(undefined)
  const sessionsStatus = createSignalObject<"loading" | "ready" | "empty" | "error">("loading")
  const projects = createSignalObject<
    readonly { readonly id: string; readonly name: string; readonly owned: boolean }[]
  >([])
  const projectRoles = createSignalObject<readonly ProjectRole[]>([])
  const assignProjectId = createSignalObject("")
  const assignRoleKeys = createSignalObject<readonly string[]>([])
  const assignSearch = createSignalObject("")
  const formError = createSignalObject<string | undefined>(undefined)
  const profileDraft = createSignalObject<Record<string, string>>({})
  const password = createSignalObject("")
  const passwordConfirm = createSignalObject("")
  const deleteConfirm = createSignalObject("")

  const fail = (failure: FailedResult) => {
    error.set(failure.errorMessage)
    status.set(failureStatusSelect(failure))
  }

  const load = async () => {
    const userId = options.userId()
    notice.set(undefined)
    if (userId === undefined || userId.length === 0) {
      error.set(messageTranslate("admin.userProfile.missingId"))
      return status.set("error")
    }
    status.set("loading")
    error.set(undefined)
    const [userResult, methodsResult, sessionsResult] = await Promise.all([
      adapter.userGet(userId),
      adapter.authenticationMethodsGet(userId),
      adapter.sessionsList(userId),
    ])
    if (!userResult.success) return fail(userResult)
    profile.set(userResult.data)
    if (methodsResult.success) {
      methods.set(methodsResult.data)
      const current = methodsResult.data
      methodsStatus.set(
        !current.emailOtp.available &&
          current.passkeys.credentials.length === 0 &&
          !current.password.available &&
          !current.recoveryCodes.available &&
          !current.totp.enrolled
          ? "empty"
          : "ready",
      )
    } else {
      methodsError.set(methodsResult.errorMessage)
      methodsStatus.set("error")
    }
    if (sessionsResult.success) {
      sessions.set(sessionsResult.data.filter((session) => session.revokedAt === null))
      sessionsStatus.set(sessions.get().length === 0 ? "empty" : "ready")
    } else {
      sessionsError.set(sessionsResult.errorMessage)
      sessionsStatus.set("error")
    }
    status.set(userResult.data.user === undefined ? "empty" : "ready")
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

  /**
   * Success check for `Result<void>` mutations, whose successful data is `undefined` and must
   * not read as failure (user deletion, realm-admin changes, session revocation).
   */
  const mutateVoid = async (id: string, operation: () => Promise<Result<void>>): Promise<boolean> => {
    pendingId.set(id)
    error.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (!result.success) {
      fail(result)
      return false
    }
    return true
  }

  createEffect(
    on(
      () => `${options.userId() ?? ""}:${options.realmId()}:${options.organizationId()}:${options.reloadKey?.() ?? ""}`,
      () => void load(),
    ),
  )

  const confirmed = async (request: ConfirmRequest) => (await options.confirm(request)) === true

  const profileReload = async () => {
    const userId = options.userId()
    if (userId === undefined) return
    const result = await adapter.userGet(userId)
    if (!result.success) return fail(result)
    profile.set(result.data)
  }

  const targetRoles = (): readonly OrganizationRoleId[] | undefined => {
    const memberships = profile.get()?.access?.memberships ?? []
    const membership = memberships.find((item) => item.organizationId === options.organizationId())
    return membership?.roles
  }
  const permissionTarget = () => ({
    realmAdministrator: profile.get()?.access?.realmAdministrator ?? false,
    roles: targetRoles(),
  })
  const actor = () => ({
    organizationRoles: [...options.actorOrganizationRoles()],
    realmAdministrator: options.actorRealmAdministrator(),
  })

  const organizationMembership = () => {
    const memberships = profile.get()?.access?.memberships ?? []
    return memberships.find((item) => item.organizationId === options.organizationId())
  }

  const assignmentGroups = (): readonly DirectoryProjectAssignment[] => profile.get()?.access?.projectAssignments ?? []

  const assignmentFor = (assignmentId: string): { assignment: DirectoryProjectAssignment } | undefined => {
    const assignment = assignmentGroups().find((item) => item.assignmentId === assignmentId)
    return assignment === undefined ? undefined : { assignment }
  }

  return {
    actorGet: actor,
    assignProjectId: assignProjectId,
    assignRoleKeysGet: assignRoleKeys.get,
    assignRoleToggle: (key: string) => {
      const current = assignRoleKeys.get()
      assignRoleKeys.set(current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
    },
    assignRolesLoad: async (projectId: string) => {
      assignProjectId.set(projectId)
      assignRoleKeys.set(assignmentGroups().find((item) => item.projectId === projectId)?.roleKeys ?? [])
      const result = await adapter.projectRoleList(projectId)
      if (!result.success) {
        formError.set(result.errorMessage)
        return
      }
      projectRoles.set([...result.data])
    },
    assignRolesSave: async () => {
      const userId = options.userId()
      const projectId = assignProjectId.get()
      if (userId === undefined || projectId.length === 0) return false
      formError.set(undefined)
      const existing = assignmentGroups().find((item) => item.projectId === projectId)
      if (existing === undefined) {
        const created = await mutate(`assignment:create:${projectId}`, () =>
          adapter.assignmentCreate(projectId, { roleKeys: [...assignRoleKeys.get()], userId }),
        )
        if (created === undefined) return false
      } else {
        const updated = await mutate(`assignment:update:${existing.assignmentId}`, () =>
          adapter.assignmentUpdate(projectId, existing.assignmentId, { roleKeys: [...assignRoleKeys.get()] }),
        )
        if (updated === undefined) return false
      }
      notice.set(messageTranslate("admin.userProfile.projectRolesSaved"))
      await profileReload()
      return true
    },
    assignSearchGet: assignSearch.get,
    assignSearchSet: assignSearch.set,
    assignmentFor,
    assignmentGroups,
    assignmentRemove: async (assignmentId: string, projectName: string) => {
      const userId = options.userId()
      if (userId === undefined) return
      const accepted = await confirmed({
        message: messageTranslate("admin.userProfile.projectRolesRemoveConfirm", { projectName }),
        title: messageTranslate("admin.userProfile.projectRolesRemove"),
      })
      if (!accepted) return
      const found = assignmentGroups().find((item) => item.assignmentId === assignmentId)
      if (found === undefined) return
      const removed = await mutate(`assignment:remove:${assignmentId}`, () =>
        adapter.assignmentRemove(found.projectId, assignmentId),
      )
      if (removed === undefined) return
      notice.set(messageTranslate("admin.userProfile.projectRolesRemoved"))
      await profileReload()
    },
    deleteConfirmGet: deleteConfirm.get,
    deleteConfirmSet: deleteConfirm.set,
    deleteSubmit: async () => {
      const userId = options.userId()
      const user = profile.get()?.user
      if (userId === undefined || user === undefined) return false
      formError.set(undefined)
      if (deleteConfirm.get().trim() !== user.userName) {
        formError.set(messageTranslate("admin.userProfile.deleteConfirmMismatch"))
        return false
      }
      if (!(await mutateVoid(`user:delete:${userId}`, () => adapter.userDelete(userId)))) return false
      notice.set(messageTranslate("admin.userProfile.deleted", { userName: user.userName }))
      return true
    },
    errorGet: error.get,
    formErrorClear: () => formError.set(undefined),
    formErrorGet: formError.get,
    lifecycleSet: async (state: UserState) => {
      const userId = options.userId()
      const user = profile.get()?.user
      if (userId === undefined || user === undefined) return
      const key =
        state === "active" && user.state === "locked"
          ? "admin.userProfile.unlockConfirm"
          : state === "active"
            ? "admin.userProfile.reactivateConfirm"
            : "admin.userProfile.deactivateConfirm"
      const accepted = await confirmed({ message: messageTranslate(key, { userName: user.userName }) })
      if (!accepted) return
      const updated = await mutate(`user:lifecycle:${userId}`, () => adapter.userLifecycleSet(userId, { state }))
      if (updated === undefined) return
      profile.set(updated)
      const done =
        state === "active" && user.state === "locked"
          ? "admin.userProfile.unlocked"
          : state === "active"
            ? "admin.userProfile.reactivated"
            : "admin.userProfile.deactivated"
      notice.set(messageTranslate(done, { userName: user.userName }))
    },
    membershipAdd: async () => {
      const userId = options.userId()
      const user = profile.get()?.user
      if (userId === undefined || user === undefined) return
      const created = await mutate(`membership:create:${userId}`, () =>
        adapter.membershipCreate(options.organizationId(), { roles: ["member"], userId }),
      )
      if (created === undefined) return
      notice.set(messageTranslate("admin.userProfile.membershipAdded", { userName: user.userName }))
      await profileReload()
    },
    methodsGet: methods.get,
    methodsErrorGet: methodsError.get,
    methodsReload: () => void load(),
    methodsStatusGet: methodsStatus.get,
    noticeGet: notice.get,
    organizationMembershipGet: organizationMembership,
    organizationRoleSingleSet: async (role: OrganizationRoleId) => {
      const membership = organizationMembership()
      if (membership === undefined) return
      if (role === "owner" && !actor().realmAdministrator && !actor().organizationRoles.includes("owner")) return
      const updated = await mutate(`membership:role:${membership.membershipId}`, () =>
        adapter.membershipUpdate(options.organizationId(), membership.membershipId, { roles: [role] }),
      )
      if (updated === undefined) return
      notice.set(messageTranslate("admin.userProfile.organizationRoleChanged"))
      await profileReload()
    },
    passwordGet: password.get,
    passwordSet: password.set,
    passwordConfirmGet: passwordConfirm.get,
    passwordConfirmSet: passwordConfirm.set,
    passwordSubmit: async () => {
      const userId = options.userId()
      if (userId === undefined) return false
      formError.set(undefined)
      if (password.get().length < 8) {
        formError.set(messageTranslate("admin.userProfile.passwordTooShort"))
        return false
      }
      if (password.get() !== passwordConfirm.get()) {
        formError.set(messageTranslate("admin.userProfile.passwordMismatch"))
        return false
      }
      const changed = await mutate(`password:set:${userId}`, () => adapter.passwordSet(userId, password.get()))
      if (changed === undefined) return false
      password.set("")
      passwordConfirm.set("")
      notice.set(messageTranslate("admin.userProfile.passwordSaved"))
      return true
    },
    pendingIdGet: pendingId.get,
    permissionsGet: () => directoryUserProfilePermissionsResolve(actor(), permissionTarget()),
    profileGet: profile.get,
    profileDraftGet: profileDraft.get,
    profileDraftSet: (key: string, value: string) => profileDraft.set({ ...profileDraft.get(), [key]: value }),
    profileEditLoad: (user: { profile: Record<string, string | undefined>; userName: string }) => {
      profileDraft.set({
        displayName: user.profile.displayName ?? "",
        firstName: user.profile.firstName ?? "",
        lastName: user.profile.lastName ?? "",
        nickName: user.profile.nickName ?? "",
        preferredLanguage: user.profile.preferredLanguage ?? "",
      })
    },
    profileSave: async () => {
      const userId = options.userId()
      if (userId === undefined) return false
      formError.set(undefined)
      // Fields the admin did not touch (e.g. the dialog was opened from a `?dialog=` URL) keep
      // their stored value instead of being cleared.
      const stored = profile.get()?.user?.profile
      const draft = {
        displayName: profileDraft.get().displayName ?? stored?.displayName ?? "",
        firstName: profileDraft.get().firstName ?? stored?.firstName ?? "",
        lastName: profileDraft.get().lastName ?? stored?.lastName ?? "",
        nickName: profileDraft.get().nickName ?? stored?.nickName ?? "",
        preferredLanguage: profileDraft.get().preferredLanguage ?? stored?.preferredLanguage ?? "",
      }
      const displayName = draft.displayName.trim()
      if (displayName.length === 0) {
        formError.set(messageTranslate("admin.users.displayNameRequired"))
        return false
      }
      const updated = await mutate(`user:profile:${userId}`, () =>
        adapter.userProfileUpdate(userId, {
          displayName,
          firstName: draft.firstName.trim() || null,
          lastName: draft.lastName.trim() || null,
          nickName: draft.nickName.trim() || null,
          preferredLanguage: draft.preferredLanguage.trim() || null,
        }),
      )
      if (updated === undefined) return false
      profile.set(updated)
      notice.set(messageTranslate("admin.userProfile.profileSaved"))
      return true
    },
    projectsGet: projects.get,
    projectsEnsure: async () => {
      if (projects.get().length > 0) return
      const result = await adapter.projectList()
      if (!result.success) {
        formError.set(result.errorMessage)
        return
      }
      const organizationId = options.organizationId()
      projects.set(
        result.data.map((project) => ({
          id: project.id,
          name: project.name,
          owned: project.organizationId === organizationId,
        })),
      )
    },
    projectsLoad: async () => {
      const result = await adapter.projectList()
      if (!result.success) {
        formError.set(result.errorMessage)
        return
      }
      const organizationId = options.organizationId()
      projects.set(
        result.data.map((project) => ({
          id: project.id,
          name: project.name,
          owned: project.organizationId === organizationId,
        })),
      )
    },
    projectRolesGet: projectRoles.get,
    realmAdministratorGrant: async () => {
      const userId = options.userId()
      const user = profile.get()?.user
      if (userId === undefined || user === undefined) return
      const accepted = await confirmed({
        message: messageTranslate("admin.userProfile.makeRealmAdminConfirm", { userName: user.userName }),
      })
      if (!accepted) return
      if (!(await mutateVoid(`realm-admin:grant:${userId}`, () => adapter.realmAdministratorGrant(userId)))) return
      notice.set(messageTranslate("admin.userProfile.makeRealmAdminDone", { userName: user.userName }))
      await profileReload()
    },
    realmAdministratorRevoke: async () => {
      const userId = options.userId()
      const user = profile.get()?.user
      if (userId === undefined || user === undefined) return
      const accepted = await confirmed({
        message: messageTranslate("admin.userProfile.removeRealmAdminConfirm", { userName: user.userName }),
      })
      if (!accepted) return
      if (!(await mutateVoid(`realm-admin:revoke:${userId}`, () => adapter.realmAdministratorRevoke(userId)))) return
      notice.set(messageTranslate("admin.userProfile.removeRealmAdminDone", { userName: user.userName }))
      await profileReload()
    },
    reload: () => void load(),
    sessionsGet: sessions.get,
    sessionsErrorGet: sessionsError.get,
    sessionsReload: () => void load(),
    sessionsStatusGet: sessionsStatus.get,
    sessionRevoke: async (sessionId: string) => {
      const userId = options.userId()
      const user = profile.get()?.user
      if (userId === undefined || user === undefined) return
      const accepted = await confirmed({
        message: messageTranslate("admin.userProfile.sessionsRevokeConfirm"),
      })
      if (!accepted) return
      if (!(await mutateVoid(`session:revoke:${sessionId}`, () => adapter.sessionRevoke(userId, sessionId)))) return
      sessions.set(sessions.get().filter((session) => session.id !== sessionId))
      sessionsStatus.set(sessions.get().length === 0 ? "empty" : "ready")
      notice.set(messageTranslate("admin.userProfile.sessionsRevoked"))
    },
    sessionsRevokeAll: async () => {
      const userId = options.userId()
      const user = profile.get()?.user
      if (userId === undefined || user === undefined) return
      const accepted = await confirmed({
        message: messageTranslate("admin.userProfile.revokeAllConfirm", { userName: user.userName }),
      })
      if (!accepted) return
      if (!(await mutateVoid(`session:revoke-all:${userId}`, () => adapter.sessionRevokeAll(userId)))) return
      sessions.set([])
      sessionsStatus.set("empty")
      notice.set(messageTranslate("admin.userProfile.revokeAllDone"))
    },
    statusGet: status.get,
    targetRolesGet: targetRoles,
    userAssignmentOf: (assignment: DirectoryProjectAssignment): ProjectUserAssignment => ({
      createdAt: 0,
      id: assignment.assignmentId,
      projectId: assignment.projectId,
      realmId: "",
      roleKeys: [...assignment.roleKeys],
      updatedAt: 0,
      userId: options.userId() ?? "",
    }),
  }
}

export type DirectoryUserProfilePageState = ReturnType<typeof directoryUserProfilePageStateCreate>
