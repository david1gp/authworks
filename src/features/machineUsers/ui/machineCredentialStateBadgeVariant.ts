import type { MachineCredentialState } from "./machineCredentialStateSelect.js"

export function machineCredentialStateBadgeVariant(
  state: MachineCredentialState,
): "filledGreen" | "filledRed" | "filledYellow" {
  if (state === "active") return "filledGreen"
  if (state === "expired") return "filledYellow"
  return "filledRed"
}
