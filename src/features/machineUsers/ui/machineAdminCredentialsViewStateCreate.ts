import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { machineAdminCredentialFormStateCreate } from "./machineAdminCredentialFormStateCreate.js"
import type { MachineAdminPageState } from "./machineAdminPageStateCreate.js"

/** View state for the realm-wide credential overview: choosing a subject and issuing or revoking. */
export function machineAdminCredentialsViewStateCreate(options: {
  readonly issueKind: () => "api_key" | "personal_access_token"
  readonly issueKindSet: (kind: "api_key" | "personal_access_token") => void
  readonly issueOpen: () => boolean
  readonly issueOpenSet: (open: boolean) => void
  readonly machineUserId: () => string | undefined
  readonly machineUserIdSet: (machineUserId: string) => void
  readonly page: MachineAdminPageState
}) {
  const selectedId = createSignalObject("")

  const activeMachineUserId = () => options.machineUserId() ?? options.page.machineUsers()[0]?.id ?? ""

  const credentialForm = machineAdminCredentialFormStateCreate({
    kind: options.issueKind,
    machineUserId: () => {
      const id = activeMachineUserId()
      return id === "" ? undefined : id
    },
    onIssued: () => options.issueOpenSet(false),
    page: options.page,
  })

  return {
    activeMachineUserId,
    credentialForm,
    issueKind: options.issueKind,
    issueKindSet: options.issueKindSet,
    issueOpen: options.issueOpen,
    issueOpenSet: options.issueOpenSet,
    machineUserIdSignal: {
      get: () => (selectedId.get() === "" ? activeMachineUserId() : selectedId.get()),
      set: (machineUserId: string) => {
        selectedId.set(machineUserId)
        options.machineUserIdSet(machineUserId)
      },
    },
    page: options.page,
  }
}
