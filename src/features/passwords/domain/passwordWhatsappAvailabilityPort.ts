import type { Result } from "#result"
import type { WhatsappOtpAvailabilityResponse } from "../../whatsappOtp/public/whatsappOtpAvailabilityResponseSchema.js"

export type PasswordWhatsappAvailabilityPort = {
  readonly whatsappOtpAvailabilityGet: (input: {
    readonly organizationId?: string
    readonly realmId: string
  }) => Result<WhatsappOtpAvailabilityResponse>
}
