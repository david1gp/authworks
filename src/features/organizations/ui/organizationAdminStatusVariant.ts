import type { OrganizationStatus } from "../public/organizationStatusSchema.js"

const variants = { active: "filledGreen", inactive: "filledYellow", removed: "filledRed" } as const

/** Maps an organization lifecycle status onto its badge variant. */
export function organizationAdminStatusVariant(status: OrganizationStatus) {
  return variants[status]
}
