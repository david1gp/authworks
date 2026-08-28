import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { MachineUserStatus } from "../public/machineUserStatusSchema.js"

const tones = { active: "success", inactive: "warning", removed: "danger" } as const satisfies Record<
  MachineUserStatus,
  AuthenticatedStatusTone
>

/** Maps a machine-user lifecycle status onto the shared authenticated status tone. */
export function machineUserStatusTone(status: MachineUserStatus): AuthenticatedStatusTone {
  return tones[status]
}
