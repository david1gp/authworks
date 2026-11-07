import type { Result } from "#result"
import type { WhatsappOtpUsageQuery } from "../public/whatsappOtpUsageQuerySchema.js"
import type { WhatsappOtpUsageResponse } from "../public/whatsappOtpUsageResponseSchema.js"

export type WhatsappOtpUsagePort = {
  readonly whatsappOtpUsageGet: (input: {
    readonly limit: number
    readonly realmId: string
    readonly window: WhatsappOtpUsageQuery["window"]
  }) => Result<WhatsappOtpUsageResponse>
}
