import * as v from "valibot"
import { emailOtpDeliverySchema } from "../../emailOtp/public/emailOtpDeliverySchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

export const emailOtpRenderRequestSchema = v.strictObject({
  delivery: emailOtpDeliverySchema,
  footer: emailGeneratorFooterSchema,
  url: v.pipe(v.string(), v.minLength(1)),
})

export type EmailOtpRenderRequest = v.InferOutput<typeof emailOtpRenderRequestSchema>
