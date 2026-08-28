import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { MachineCredentialState } from "./machineCredentialStateSelect.js"

const tones = { active: "success", expired: "warning", revoked: "danger" } as const satisfies Record<
  MachineCredentialState,
  AuthenticatedStatusTone
>

/** Maps the derived credential state onto the shared authenticated status tone. */
export function machineCredentialStateTone(state: MachineCredentialState): AuthenticatedStatusTone {
  return tones[state]
}
