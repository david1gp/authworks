import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for the project detail header: back link, lifecycle menu, and typed confirms. */
export function projectAdminDetailViewStateCreate(options: {
  readonly basePath: string
  readonly canManage: () => boolean
  readonly onDeleted: () => void
  readonly organizationId: () => string | undefined
  readonly page: ProjectAdminPageState
  readonly removeOpen: () => boolean
  readonly removeOpenSet: (open: boolean) => void
  readonly renameOpen: () => boolean
  readonly renameOpenSet: (open: boolean) => void
  readonly tab: () => "overview" | "roles" | "applications" | "access"
  readonly withActor: (href: string) => string
}) {
  const renameName = createSignalObject("")
  const renameError = createSignalObject<string | undefined>(undefined)
  const removeName = createSignalObject("")
  const removeError = createSignalObject<string | undefined>(undefined)

  // Opening rename pre-fills the current name; closing either dialog clears its form state.
  const renameOpenSet = (open: boolean) => {
    if (open) {
      renameError.set(undefined)
      renameName.set(options.page.project()?.name ?? "")
    }
    options.renameOpenSet(open)
  }
  const removeOpenSet = (open: boolean) => {
    if (!open) {
      removeError.set(undefined)
      removeName.set("")
    }
    options.removeOpenSet(open)
  }

  const backHref = () => options.withActor(`${options.basePath}/projects`)
  const baseHref = () => {
    const projectId = options.page.project()?.id ?? ""
    return options.withActor(
      projectId.length === 0 ? `${options.basePath}/projects` : `${options.basePath}/projects/${projectId}`,
    )
  }
  const tabHref = (tab: "overview" | "roles" | "applications" | "access") =>
    tab === "overview" ? baseHref() : `${baseHref()}?tab=${tab}`

  const lifecycleSet = (status: "active" | "inactive" | "removed") => {
    const project = options.page.project()
    if (project === undefined || status === "removed") return
    void options.page.projectLifecycleSet(project.id, status)
  }

  const renameSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    const project = options.page.project()
    if (project === undefined) return
    const next = renameName.get().trim()
    if (next.length === 0) {
      renameError.set(messageTranslate("admin.projects.detail.renameInvalid"))
      return
    }
    renameError.set(undefined)
    void options.page.projectUpdate(project.id, {
      authorizationRequired: project.authorizationRequired,
      name: next,
      projectAccessRequired: project.projectAccessRequired,
    })
  }

  const removeSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const project = options.page.project()
    if (project === undefined) return
    if (removeName.get().trim() !== project.name) {
      removeError.set(messageTranslate("admin.projects.detail.removeTypeMismatch"))
      return
    }
    removeError.set(undefined)
    const deleted = await options.page.projectDelete(project.id)
    if (deleted) options.onDeleted()
  }

  return {
    backHref,
    baseHref,
    canManage: options.canManage,
    removeErrorClear: () => removeError.set(undefined),
    removeOpen: options.removeOpen,
    removeOpenSet,
    renameOpen: options.renameOpen,
    renameOpenSet,
    lifecycleSet,
    organizationId: options.organizationId,
    page: options.page,
    removeError: removeError.get,
    removeName,
    removeSubmit,
    renameError: renameError.get,
    renameName,
    renameSubmit,
    tab: options.tab,
    tabHref,
  }
}
