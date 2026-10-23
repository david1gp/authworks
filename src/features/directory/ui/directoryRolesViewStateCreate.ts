import { useLocation, useNavigate } from "@solidjs/router"
import { createEffect } from "solid-js"
import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { projectRoleCreateRequestSchema } from "../../projects/public/projectRoleCreateRequestSchema.js"
import { projectRoleUpdateRequestSchema } from "../../projects/public/projectRoleUpdateRequestSchema.js"
import { directoryRolesKeyDerive } from "./directoryRolesKeyDerive.js"
import type { DirectoryRolesPageState } from "./directoryRolesPageStateCreate.js"

const dialogSchema = v.picklist(["new-role", "edit-role"])
const dialogSearchSchema = v.object({
  dialog: v.optional(dialogSchema),
  project: v.optional(v.string()),
  role: v.optional(v.string()),
})

/**
 * View state for the roles page: URL-held new/edit role dialogs with a
 * display-name-derived key, form input, and backend-schema validation.
 */
export function directoryRolesViewStateCreate(options: {
  readonly asParam: () => string | undefined
  readonly basePath: string
  readonly page: DirectoryRolesPageState
}) {
  const location = useLocation()
  const navigate = useNavigate()
  type DialogSearch = v.InferOutput<typeof dialogSearchSchema>

  const dialogSearchRead = (): DialogSearch | undefined => {
    const params = new URLSearchParams(location.search)
    const parsed = v.safeParse(dialogSearchSchema, {
      ...(params.get("dialog") === null ? {} : { dialog: params.get("dialog") }),
      ...(params.get("project") === null ? {} : { project: params.get("project") }),
      ...(params.get("role") === null ? {} : { role: params.get("role") }),
    })
    return parsed.success ? parsed.output : undefined
  }
  const dialog = () => dialogSearchRead()?.dialog
  const dialogProjectId = () => dialogSearchRead()?.project
  const dialogRoleId = () => dialogSearchRead()?.role

  const displayName = createSignalObject("")
  const key = createSignalObject("")
  const keyTouched = createSignalObject(false)
  const group = createSignalObject("")
  const projectId = createSignalObject("")
  const formError = createSignalObject<string | undefined>(undefined)

  const dialogParamsSet = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search)
    mutate(params)
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const dialogOpenSet = (kind: "new-role" | "edit-role", project?: string, role?: string) => (open: boolean) =>
    dialogParamsSet((params) => {
      if (open) {
        params.set("dialog", kind)
        if (project !== undefined) params.set("project", project)
        if (role !== undefined) params.set("role", role)
      } else {
        params.delete("dialog")
        params.delete("project")
        params.delete("role")
      }
    })
  const dialogClose = () =>
    dialogParamsSet((params) => {
      params.delete("dialog")
      params.delete("project")
      params.delete("role")
    })

  const dialogProject = () => {
    const selected = projectId.get()
    if (selected.length > 0) return options.page.entry(selected)
    const preselected = dialogProjectId()
    if (preselected !== undefined) return options.page.entry(preselected)
    return undefined
  }
  const dialogEntry = () => dialogProject() ?? options.page.entries()[0]
  const dialogRole = () => {
    const roleId = dialogRoleId()
    if (roleId === undefined) return undefined
    return dialogEntry()?.roles.find((role) => role.id === roleId)
  }
  const isEditing = () => dialog() === "edit-role"
  const dialogOpen = () => dialog() !== undefined

  // Opening a dialog (re)seeds the form; the edit form tracks the stored role.
  createEffect(() => {
    if (!dialogOpen()) return
    formError.set(undefined)
    keyTouched.set(false)
    if (isEditing()) {
      const role = dialogRole()
      displayName.set(role?.displayName ?? "")
      key.set(role?.key ?? "")
      group.set(role?.group ?? "")
      projectId.set(dialogProjectId() ?? dialogProject()?.project.id ?? "")
      return
    }
    displayName.set("")
    key.set("")
    group.set("")
    projectId.set(dialogProjectId() ?? "")
  })

  const displayNameInput = (value: string) => {
    displayName.set(value)
    if (!keyTouched.get() && !isEditing()) key.set(directoryRolesKeyDerive(value))
  }

  const dialogSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const entry = dialogEntry()
    if (entry === undefined) {
      formError.set(messageTranslate("admin.roles.dialog.noProject"))
      return
    }
    const trimmedGroup = group.get().trim()
    if (isEditing()) {
      const role = dialogRole()
      if (role === undefined) {
        formError.set(messageTranslate("admin.roles.dialog.missingRole"))
        return
      }
      const parsed = v.safeParse(projectRoleUpdateRequestSchema, {
        displayName: displayName.get(),
        ...(trimmedGroup.length === 0 ? { group: null } : { group: trimmedGroup }),
      })
      if (!parsed.success) {
        formError.set(messageTranslate("admin.roles.dialog.invalid"))
        return
      }
      formError.set(undefined)
      const saved = await options.page.roleUpdate(entry.project.id, role.id, parsed.output)
      if (!saved) return
      dialogClose()
      return
    }
    const parsed = v.safeParse(projectRoleCreateRequestSchema, {
      displayName: displayName.get(),
      ...(trimmedGroup.length === 0 ? {} : { group: trimmedGroup }),
      key: key.get(),
    })
    if (!parsed.success) {
      formError.set(messageTranslate("admin.roles.dialog.invalid"))
      return
    }
    formError.set(undefined)
    const created = await options.page.roleCreate(entry.project.id, parsed.output)
    if (!created) return
    dialogClose()
  }

  const withActor = (href: string) => {
    const actor = options.asParam()
    if (actor === undefined || actor.length === 0) return href
    return `${href}${href.includes("?") ? "&" : "?"}as=${encodeURIComponent(actor)}`
  }

  return {
    dialogClose,
    dialogEntry,
    dialogOpen,
    dialogRole,
    dialogSubmit,
    displayName,
    displayNameInput,
    formError: formError.get,
    group,
    isEditing,
    key,
    keyTouched,
    newRoleOpen: (projectId?: string) => dialog() === "new-role" && dialogProjectId() === projectId,
    newRoleOpenSet: (projectId?: string) => dialogOpenSet("new-role", projectId),
    editRoleOpen: (projectId: string, roleId: string) =>
      dialog() === "edit-role" && dialogProjectId() === projectId && dialogRoleId() === roleId,
    editRoleOpenSet: (projectId: string, roleId: string) => dialogOpenSet("edit-role", projectId, roleId),
    page: options.page,
    projectHref: (projectId: string) => withActor(`${options.basePath}/projects/${projectId}`),
    projectId,
    projectsHref: () => withActor(`${options.basePath}/projects`),
    usersHref: (roleId: string) => withActor(`${options.basePath}/users?role=${encodeURIComponent(roleId)}`),
  }
}

export type DirectoryRolesViewState = ReturnType<typeof directoryRolesViewStateCreate>
