import * as v from "valibot"
import { passwordRegistrationDeliverySchema } from "../../passwords/public/passwordRegistrationDeliverySchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

export const emailVerificationRenderRequestSchema = v.strictObject({
  delivery: passwordRegistrationDeliverySchema,
  footer: emailGeneratorFooterSchema,
  url: v.pipe(v.string(), v.minLength(1)),
})

export type EmailVerificationRenderRequest = v.InferOutput<typeof emailVerificationRenderRequestSchema>
