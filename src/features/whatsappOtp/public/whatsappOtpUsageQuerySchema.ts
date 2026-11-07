import * as v from "valibot"

export const whatsappOtpUsageQuerySchema = v.strictObject({
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)), 50),
})

export type WhatsappOtpUsageQuery = v.InferOutput<typeof whatsappOtpUsageQuerySchema>
