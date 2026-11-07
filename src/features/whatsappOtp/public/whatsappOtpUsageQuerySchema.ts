import * as v from "valibot"

export const whatsappOtpUsageQuerySchema = v.strictObject({
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)), 50),
  window: v.optional(v.picklist(["24h", "3d", "7d"]), "24h"),
})

export type WhatsappOtpUsageQuery = v.InferOutput<typeof whatsappOtpUsageQuerySchema>
export type WhatsappOtpUsageQueryInput = v.InferInput<typeof whatsappOtpUsageQuerySchema>
