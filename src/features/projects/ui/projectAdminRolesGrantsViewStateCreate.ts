import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { projectGrantCreateRequestSchema } from "../public/projectGrantCreateRequestSchema.js"
import { projectRoleCreateRequestSchema } from "../public/projectRoleCreateRequestSchema.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for project roles plus organization and cross-organization grants. */
export function projectAdminRolesGrantsViewStateCreate(options: {
  readonly grantCreateOpen: () => boolean
  readonly grantCreateOpenSet: (open: boolean) => void
  readonly page: ProjectAdminPageState
  readonly projectId: () => string
  readonly roleCreateOpen: () => boolean
  readonly roleCreateOpenSet: (open: boolean) => void
}) {
  const roleKey = createSignalObject("")
  const roleDisplayName = createSignalObject("")
  const roleGroup = createSignalObject("")
  const roleFormError = createSignalObject<string | undefined>(undefined)
  const grantOrganizationId = createSignalObject("")
  const grantRoleKeys = createSignalObject<readonly string[]>([])
  const grantFormError = createSignalObject<string | undefined>(undefined)

  /** Cross-organization grants exclude the organization that already owns the project. */
  const grantableOrganizations = () => {
    const owningOrganizationId = options.page.project()?.organizationId
    return options.page.organizations().filter((organization) => organization.id !== owningOrganizationId)
  }

  const roleCreateSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const group = roleGroup.get().trim()
    const parsed = v.safeParse(projectRoleCreateRequestSchema, {
      displayName: roleDisplayName.get(),
      ...(group.length === 0 ? {} : { group }),
      key: roleKey.get(),
    })
    if (!parsed.success) {
      roleFormError.set(messageTranslate("admin.projects.roles.invalid"))
      return
    }
    roleFormError.set(undefined)
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
    options.roleCreateOpenSet(false)
  }

  const grantCreateSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const selectedOrganization = grantOrganizationId.get() || (grantableOrganizations()[0]?.id ?? "")
    const parsed = v.safeParse(projectGrantCreateRequestSchema, {
      grantedOrganizationId: selectedOrganization,
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
    options.grantCreateOpenSet(false)
  }

  return {
    grantableOrganizations,
    grantCreateOpen: options.grantCreateOpen,
    grantCreateOpenSet: (open: boolean) => {
      grantFormError.set(undefined)
      options.grantCreateOpenSet(open)
    },
    grantCreateSubmit,
    grantDelete: (grantId: string) => void options.page.grantDelete(options.projectId(), grantId),
    grantFormError: grantFormError.get,
    grantLifecycleSet: (grantId: string, status: "active" | "inactive" | "removed") =>
      void options.page.grantLifecycleSet(options.projectId(), grantId, status),
    grantOrganizationId,
    grantRoleKeys,
    grantRoleToggle: (key: string) => {
      const current = grantRoleKeys.get()
      grantRoleKeys.set(current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
    },
    page: options.page,
    roleCreateOpen: options.roleCreateOpen,
    roleCreateOpenSet: (open: boolean) => {
      roleFormError.set(undefined)
      options.roleCreateOpenSet(open)
    },
    roleCreateSubmit,
    roleDelete: (roleId: string) => void options.page.roleDelete(options.projectId(), roleId),
    roleDisplayName,
    roleFormError: roleFormError.get,
    roleGroup,
    roleKey,
  }
}
