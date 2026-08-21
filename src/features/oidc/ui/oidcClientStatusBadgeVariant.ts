import type { OidcClientStatus } from "../public/oidcClientStatusSchema.js"

export function oidcClientStatusBadgeVariant(status: OidcClientStatus): "filledGreen" | "filledRed" | "filledYellow" {
  if (status === "active") return "filledGreen"
  if (status === "inactive") return "filledYellow"
  return "filledRed"
}
