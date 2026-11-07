import * as v from "valibot"

const whatsappOtpUsageCountSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

export const whatsappOtpUsageResponseSchema = v.strictObject({
  limits: v.strictObject({
    dailyPerSender: whatsappOtpUsageCountSchema,
    hourlyPerSender: whatsappOtpUsageCountSchema,
  }),
  senders: v.array(
    v.strictObject({
      endpointId: v.pipe(v.string(), v.minLength(1)),
      healthy: v.boolean(),
      remainingDay: whatsappOtpUsageCountSchema,
      remainingHour: whatsappOtpUsageCountSchema,
      sentLastDay: whatsappOtpUsageCountSchema,
      sentLastHour: whatsappOtpUsageCountSchema,
      sessionName: v.pipe(v.string(), v.minLength(1)),
    }),
  ),
  totals: v.strictObject({
    sentLastDay: whatsappOtpUsageCountSchema,
    sentLastHour: whatsappOtpUsageCountSchema,
  }),
  requests: v.strictObject({
    otpRequestedLastDay: whatsappOtpUsageCountSchema,
    otpRequestedLastHour: whatsappOtpUsageCountSchema,
  }),
  attempts: v.strictObject({
    byStatusLastHour: v.strictObject({
      blocked: whatsappOtpUsageCountSchema,
      failed: whatsappOtpUsageCountSchema,
      sent: whatsappOtpUsageCountSchema,
    }),
    byStatusLastDay: v.strictObject({
      blocked: whatsappOtpUsageCountSchema,
      failed: whatsappOtpUsageCountSchema,
      sent: whatsappOtpUsageCountSchema,
    }),
    byPurposeLastDay: v.record(v.string(), whatsappOtpUsageCountSchema),
  }),
  recent: v.array(
    v.strictObject({
      createdAt: whatsappOtpUsageCountSchema,
      endpointId: v.pipe(v.string(), v.minLength(1)),
      purpose: v.pipe(v.string(), v.minLength(1)),
      realmId: v.nullable(v.pipe(v.string(), v.minLength(1))),
      recipientHashPrefix: v.pipe(v.string(), v.minLength(1)),
      sessionName: v.nullable(v.pipe(v.string(), v.minLength(1))),
      status: v.picklist(["sent", "failed", "blocked"]),
    }),
  ),
})

export type WhatsappOtpUsageResponse = v.InferOutput<typeof whatsappOtpUsageResponseSchema>
