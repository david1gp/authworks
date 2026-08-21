import type { MachineUserStatus } from "../public/machineUserStatusSchema.js"

export function machineUserStatusBadgeVariant(status: MachineUserStatus): "filledGreen" | "filledRed" | "filledYellow" {
  if (status === "active") return "filledGreen"
  if (status === "inactive") return "filledYellow"
  return "filledRed"
}
