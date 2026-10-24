import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { projectRoleCreateRequestSchema } from "../public/projectRoleCreateRequestSchema.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for the project roles tab: create dialog and lifecycle actions. */
export function projectAdminRolesTabStateCreate(options: {
  readonly createOpen: () => boolean
  readonly createOpenSet: (open: boolean) => void
  readonly page: ProjectAdminPageState
  readonly projectId: () => string
}) {
  const roleKey = createSignalObject("")
  const roleDisplayName = createSignalObject("")
  const roleGroup = createSignalObject("")
  const formError = createSignalObject<string | undefined>(undefined)

  const createSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const group = roleGroup.get().trim()
    const parsed = v.safeParse(projectRoleCreateRequestSchema, {
      displayName: roleDisplayName.get(),
      ...(group.length === 0 ? {} : { group }),
      key: roleKey.get(),
    })
    if (!parsed.success) {
      formError.set(messageTranslate("admin.projects.roles.invalid"))
      return
    }
    formError.set(undefined)
    const created = await options.page.roleCreate(
      options.projectId(),
      parsed.output.key,
      parsed.output.displayName,
      parsed.output.group,
    )
    if (!created) return
    roleKey.set("")
    roleDisplayName.set("")
    roleGroup.set("")
    options.createOpenSet(false)
  }

  return {
    createOpen: options.createOpen,
    createOpenSet: (open: boolean) => {
      formError.set(undefined)
      options.createOpenSet(open)
    },
    createSubmit,
    formError: formError.get,
    page: options.page,
    roleDelete: (roleId: string) => void options.page.roleDelete(options.projectId(), roleId),
    roleDisplayName,
    roleGroup,
    roleKey,
  }
}
