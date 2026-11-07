import type { Result } from "#result"
import type { WhatsappOtpUsageResponse } from "../public/whatsappOtpUsageResponseSchema.js"

export type WhatsappOtpUsagePort = {
  readonly whatsappOtpUsageGet: (input: {
    readonly limit: number
    readonly realmId: string
  }) => Result<WhatsappOtpUsageResponse>
}
