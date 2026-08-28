import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { OrganizationStatus } from "../public/organizationStatusSchema.js"

const tones = { active: "success", inactive: "warning", removed: "danger" } as const satisfies Record<
  OrganizationStatus,
  AuthenticatedStatusTone
>

/** Maps an organization lifecycle status onto the shared authenticated status tone. */
export function organizationAdminStatusTone(status: OrganizationStatus): AuthenticatedStatusTone {
  return tones[status]
}
