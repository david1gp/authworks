import type { Result } from "#result"
import type { WhatsappOtpAvailabilityResponse } from "../public/whatsappOtpAvailabilityResponseSchema.js"

export type WhatsappOtpAvailabilityPort = {
  readonly whatsappOtpAvailabilityGet: (input: {
    readonly organizationId?: string
    readonly realmId: string
  }) => Result<WhatsappOtpAvailabilityResponse>
}
