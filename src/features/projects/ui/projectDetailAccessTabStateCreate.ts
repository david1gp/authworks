import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { projectGrantCreateRequestSchema } from "../public/projectGrantCreateRequestSchema.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for the access tab: organization grants plus direct user assignments. */
export function projectAdminAccessTabStateCreate(options: {
  readonly assignOpen: () => boolean
  readonly assignOpenSet: (open: boolean) => void
  readonly grantOrganizationOpen: () => boolean
  readonly grantOrganizationOpenSet: (open: boolean) => void
  readonly grantRoleOpen: () => boolean
  readonly grantRoleOpenSet: (open: boolean) => void
  readonly page: ProjectAdminPageState
  readonly projectId: () => string
}) {
  const grantOrganizationId = createSignalObject("")
  const grantRoleKeys = createSignalObject<readonly string[]>([])
  const grantFormError = createSignalObject<string | undefined>(undefined)
  const assignUserId = createSignalObject("")
  const assignRoleKeys = createSignalObject<readonly string[]>([])
  const assignFormError = createSignalObject<string | undefined>(undefined)

  /** Organization grants target other organizations so members inherit project roles. */
  const grantableOrganizations = () => {
    const owningOrganizationId = options.page.project()?.organizationId
    return options.page.organizations().filter((organization) => organization.id !== owningOrganizationId)
  }

  const grantOrganizationSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const parsed = v.safeParse(v.pipe(v.string(), v.minLength(1)), grantOrganizationId.get())
    if (!parsed.success) {
      grantFormError.set(messageTranslate("admin.projects.grants.invalid"))
      return
    }
    grantFormError.set(undefined)
    const created = await options.page.grantCreate(options.projectId(), parsed.output, [])
    if (!created) return
    grantOrganizationId.set("")
    options.grantOrganizationOpenSet(false)
  }

  const grantRoleSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const selected = grantOrganizationId.get() || (grantableOrganizations()[0]?.id ?? "")
    const parsed = v.safeParse(projectGrantCreateRequestSchema, {
      grantedOrganizationId: selected,
      roleKeys: [...grantRoleKeys.get()],
    })
    if (!parsed.success || parsed.output.roleKeys.length === 0) {
      grantFormError.set(messageTranslate("admin.projects.grants.invalid"))
      return
    }
    grantFormError.set(undefined)
    const created = await options.page.grantCreate(
      options.projectId(),
      parsed.output.grantedOrganizationId,
      parsed.output.roleKeys,
    )
    if (!created) return
    grantRoleKeys.set([])
    options.grantRoleOpenSet(false)
  }

  const assignSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const roleKeys = [...assignRoleKeys.get()]
    if (assignUserId.get().trim().length === 0 || roleKeys.length === 0) {
      assignFormError.set(messageTranslate("admin.projects.assignments.invalid"))
      return
    }
    assignFormError.set(undefined)
    const created = await options.page.assignmentCreate(options.projectId(), assignUserId.get().trim(), roleKeys)
    if (!created) return
    assignUserId.set("")
    assignRoleKeys.set([])
    options.assignOpenSet(false)
  }

  return {
    assignFormError: assignFormError.get,
    assignOpen: options.assignOpen,
    assignOpenSet: (open: boolean) => {
      assignFormError.set(undefined)
      options.assignOpenSet(open)
    },
    assignRemove: (assignmentId: string) => void options.page.assignmentRemove(options.projectId(), assignmentId),
    assignRoleKeys,
    assignRoleToggle: (key: string) => {
      const current = assignRoleKeys.get()
      assignRoleKeys.set(current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
    },
    assignSubmit,
    assignUserId,
    grantDelete: (grantId: string) => void options.page.grantDelete(options.projectId(), grantId),
    grantFormError: grantFormError.get,
    grantLifecycleSet: (grantId: string, status: "active" | "inactive" | "removed") =>
      void options.page.grantLifecycleSet(options.projectId(), grantId, status),
    grantOrganizationId,
    grantOrganizationOpen: options.grantOrganizationOpen,
    grantOrganizationOpenSet: (open: boolean) => {
      grantFormError.set(undefined)
      options.grantOrganizationOpenSet(open)
    },
    grantOrganizationSubmit,
    grantRoleKeys,
    grantRoleOpen: options.grantRoleOpen,
    grantRoleOpenSet: (open: boolean) => {
      grantFormError.set(undefined)
      options.grantRoleOpenSet(open)
    },
    grantRoleSubmit,
    grantRoleToggle: (key: string) => {
      const current = grantRoleKeys.get()
      grantRoleKeys.set(current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
    },
    grantableOrganizations,
    page: options.page,
  }
}
