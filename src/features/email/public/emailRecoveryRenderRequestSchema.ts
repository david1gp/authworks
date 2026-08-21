import * as v from "valibot"
import { passwordRecoveryDeliverySchema } from "../../passwords/public/passwordRecoveryDeliverySchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

export const emailRecoveryRenderRequestSchema = v.strictObject({
  delivery: passwordRecoveryDeliverySchema,
  footer: emailGeneratorFooterSchema,
  url: v.pipe(v.string(), v.minLength(1)),
})

export type EmailRecoveryRenderRequest = v.InferOutput<typeof emailRecoveryRenderRequestSchema>
