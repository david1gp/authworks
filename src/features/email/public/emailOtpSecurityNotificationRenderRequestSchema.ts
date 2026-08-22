import * as v from "valibot"
import { emailOtpSecurityNotificationSchema } from "../../emailOtp/public/emailOtpSecurityNotificationSchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

export const emailOtpSecurityNotificationRenderRequestSchema = v.strictObject({
  footer: emailGeneratorFooterSchema,
  notification: emailOtpSecurityNotificationSchema,
})

export type EmailOtpSecurityNotificationRenderRequest = v.InferOutput<
  typeof emailOtpSecurityNotificationRenderRequestSchema
>
