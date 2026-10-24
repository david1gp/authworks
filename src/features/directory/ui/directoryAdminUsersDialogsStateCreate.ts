import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { DirectoryAdminUsersPageState } from "./directoryAdminUsersPageStateCreate.js"

/** Local dialog and form state for the users page; URL params own dialog visibility. */
export function directoryAdminUsersDialogsStateCreate(options: { readonly page: DirectoryAdminUsersPageState }) {
  const page = options.page
  const inviteEmail = createSignalObject("")
  const inviteRoles = createSignalObject<readonly OrganizationRoleId[]>(["member"])
  const createEmail = createSignalObject("")
  const createUserName = createSignalObject("")
  const createFirstName = createSignalObject("")
  const createLastName = createSignalObject("")
  const createDisplayName = createSignalObject("")
  const serviceName = createSignalObject("")
  const serviceUserName = createSignalObject("")
  const serviceScopes = createSignalObject("")
  const copied = createSignalObject(false)
  const copyFailed = createSignalObject(false)

  const inviteRolesToggle = (role: OrganizationRoleId) => {
    const current = inviteRoles.get()
    if (current.includes(role)) {
      if (current.length === 1) return
      inviteRoles.set(current.filter((item) => item !== role))
      return
    }
    inviteRoles.set([...current, role])
  }

  const inviteSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    void (async () => {
      await page.invitationCreateSubmit({ email: inviteEmail.get(), roles: inviteRoles.get() })
      if (page.validationMessage() === undefined && page.invitationToken() !== undefined) {
        inviteEmail.set("")
        inviteRoles.set(["member"])
      }
    })()
  }

  const createSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    void (async () => {
      await page.userCreateSubmit({
        email: createEmail.get(),
        profile: {
          ...(createDisplayName.get().trim().length === 0 ? {} : { displayName: createDisplayName.get().trim() }),
          ...(createFirstName.get().trim().length === 0 ? {} : { firstName: createFirstName.get().trim() }),
          ...(createLastName.get().trim().length === 0 ? {} : { lastName: createLastName.get().trim() }),
        },
        userName: createUserName.get(),
      })
      if (page.validationMessage() === undefined && page.createdUser() !== undefined) {
        createEmail.set("")
        createUserName.set("")
        createFirstName.set("")
        createLastName.set("")
        createDisplayName.set("")
      }
    })()
  }

  const serviceSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    copied.set(false)
    copyFailed.set(false)
    void (async () => {
      const created = await page.serviceAccountCreateSubmit({
        displayName: serviceName.get(),
        scopes: serviceScopes.get(),
        userName: serviceUserName.get(),
      })
      if (created) {
        serviceName.set("")
        serviceUserName.set("")
        serviceScopes.set("")
      }
    })()
  }

  const copyText = async (value: string | undefined) => {
    if (value === undefined) return
    try {
      await navigator.clipboard.writeText(value)
      copyFailed.set(false)
      copied.set(true)
    } catch {
      // A denied clipboard permission must not block the operator; the value stays selectable.
      copied.set(false)
      copyFailed.set(true)
    }
  }

  return {
    copyFailed: copyFailed.get,
    copied: copied.get,
    copyReset: () => {
      copied.set(false)
      copyFailed.set(false)
    },
    copyText,
    createDisplayName,
    createEmail,
    createFirstName,
    createLastName,
    createSubmit,
    createUserName,
    inviteEmail,
    inviteRoles,
    inviteRolesToggle,
    inviteSubmit,
    serviceName,
    serviceScopes,
    serviceSubmit,
    serviceUserName,
    validationMessage: () => page.validationMessage(),
  }
}

export type DirectoryAdminUsersDialogsState = ReturnType<typeof directoryAdminUsersDialogsStateCreate>
