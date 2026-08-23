import { machineAdminCredentialFormStateCreate } from "./machineAdminCredentialFormStateCreate.js"
import type { MachineAdminPageState } from "./machineAdminPageStateCreate.js"

/**
 * View state for a single machine user: lifecycle, the write-only client secret, and the
 * credentials it owns. No stored secret is ever read back; it can only be rotated or revoked.
 */
export function machineAdminDetailViewStateCreate(options: {
  readonly issueKind: () => "api_key" | "personal_access_token"
  readonly issueKindSet: (kind: "api_key" | "personal_access_token") => void
  readonly issueOpen: () => boolean
  readonly issueOpenSet: (open: boolean) => void
  readonly onRemoved: () => void
  readonly page: MachineAdminPageState
}) {
  const machineUserId = () => options.page.machineUser()?.id

  const credentialForm = machineAdminCredentialFormStateCreate({
    kind: options.issueKind,
    machineUserId,
    onIssued: () => options.issueOpenSet(false),
    page: options.page,
  })

  return {
    credentialForm,
    issueKind: options.issueKind,
    issueKindSet: options.issueKindSet,
    issueOpen: options.issueOpen,
    issueOpenSet: options.issueOpenSet,
    machineUserRemove: async (id: string) => {
      await options.page.machineUserLifecycleSet(id, "removed")
      if (options.page.machineUser()?.status === "removed") options.onRemoved()
    },
    page: options.page,
  }
}
