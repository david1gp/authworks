import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MachineAdminPageState } from "./machineAdminPageStateCreate.js"
import { machineAdminScopeListParse } from "./machineAdminScopeListParse.js"

/**
 * Component-local edit state for one machine user: the display-name and scope drafts, the
 * dialog-local failure, and the submit that saves through the page state. The page keeps
 * the persisted machine user; this factory only holds the form drafts.
 */
export function machineAdminEditFormStateCreate(options: {
  readonly machineUserId: () => string | undefined
  readonly onSaved: () => void
  readonly page: MachineAdminPageState
}) {
  const displayName = createSignalObject("")
  const scopes = createSignalObject("")
  const formError = createSignalObject<string | undefined>(undefined)

  return {
    displayName,
    formError: formError.get,
    scopes,
    load: () => {
      const current = options.page.machineUser()
      if (current === undefined || current.id !== options.machineUserId()) return
      displayName.set(current.displayName)
      scopes.set(current.scopes.join(", "))
      formError.set(undefined)
    },
    submit: async (event: SubmitEvent) => {
      event.preventDefault()
      const machineUserId = options.machineUserId()
      if (machineUserId === undefined) return
      const name = displayName.get().trim()
      if (name.length === 0) {
        formError.set(messageTranslate("admin.machine.users.invalid"))
        return
      }
      formError.set(undefined)
      const failure = await options.page.machineUserUpdate(machineUserId, {
        displayName: name,
        scopes: [...machineAdminScopeListParse(scopes.get())],
      })
      if (failure !== undefined) {
        formError.set(failure)
        return
      }
      options.onSaved()
    },
  }
}
