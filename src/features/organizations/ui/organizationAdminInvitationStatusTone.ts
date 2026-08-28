import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { OrganizationInvitationStatus } from "../public/organizationInvitationStatusSchema.js"

const tones = {
  accepted: "success",
  declined: "neutral",
  expired: "neutral",
  pending: "warning",
  revoked: "danger",
} as const satisfies Record<OrganizationInvitationStatus, AuthenticatedStatusTone>

/** Maps an invitation lifecycle status onto the shared authenticated status tone. */
export function organizationAdminInvitationStatusTone(status: OrganizationInvitationStatus): AuthenticatedStatusTone {
  return tones[status]
}
