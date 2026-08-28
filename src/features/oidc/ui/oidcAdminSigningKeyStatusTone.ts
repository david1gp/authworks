import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { OidcSigningKeyStatus } from "../public/oidcSigningKeyStatusSchema.js"

const tones = { active: "success", retired: "neutral" } as const satisfies Record<
  OidcSigningKeyStatus,
  AuthenticatedStatusTone
>

/** Maps a signing key lifecycle status onto the shared authenticated status tone. */
export function oidcAdminSigningKeyStatusTone(status: OidcSigningKeyStatus): AuthenticatedStatusTone {
  return tones[status]
}
