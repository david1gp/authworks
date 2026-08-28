import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { OidcClientStatus } from "../public/oidcClientStatusSchema.js"

const tones = { active: "success", inactive: "warning", removed: "danger" } as const satisfies Record<
  OidcClientStatus,
  AuthenticatedStatusTone
>

/** Maps an OIDC client lifecycle status onto the shared authenticated status tone. */
export function oidcAdminClientStatusTone(status: OidcClientStatus): AuthenticatedStatusTone {
  return tones[status]
}
