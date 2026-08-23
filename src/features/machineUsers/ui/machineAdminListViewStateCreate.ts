import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { machineUserCreateRequestSchema } from "../public/machineUserCreateRequestSchema.js"
import type { MachineAdminPageState } from "./machineAdminPageStateCreate.js"
import { machineAdminScopeListParse } from "./machineAdminScopeListParse.js"

/** View state for the machine-user directory: searching, creating, and opening a service identity. */
export function machineAdminListViewStateCreate(options: {
  readonly createOpen: () => boolean
  readonly createOpenSet: (open: boolean) => void
  readonly machineUserOpen: (machineUserId: string) => void
  readonly page: MachineAdminPageState
  readonly search: () => string
  readonly searchSet: (value: string) => void
}) {
  const displayName = createSignalObject("")
  const userName = createSignalObject("")
  const scopes = createSignalObject("")
  const formError = createSignalObject<string | undefined>(undefined)

  const filteredMachineUsers = () => {
    const term = options.search().trim().toLowerCase()
    if (term.length === 0) return options.page.machineUsers()
    return options.page
      .machineUsers()
      .filter((machineUser) =>
        `${machineUser.displayName} ${machineUser.userName} ${machineUser.scopes.join(" ")}`
          .toLowerCase()
          .includes(term),
      )
  }

  const createSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const parsedScopes = machineAdminScopeListParse(scopes.get())
    const parsed = v.safeParse(machineUserCreateRequestSchema, {
      displayName: displayName.get(),
      ...(parsedScopes.length === 0 ? {} : { scopes: [...parsedScopes] }),
      userName: userName.get(),
    })
    if (!parsed.success) {
      formError.set(messageTranslate("admin.machine.users.invalid"))
      return
    }
    formError.set(undefined)
    const created = await options.page.machineUserCreate(parsed.output)
    if (!created) return
    displayName.set("")
    userName.set("")
    scopes.set("")
    options.createOpenSet(false)
  }

  return {
    createOpen: options.createOpen,
    createOpenSet: (open: boolean) => {
      formError.set(undefined)
      options.createOpenSet(open)
    },
    createSubmit,
    displayName,
    filteredMachineUsers,
    formError: formError.get,
    machineUserOpen: options.machineUserOpen,
    page: options.page,
    scopes,
    search: options.search,
    searchSet: options.searchSet,
    userName,
  }
}
