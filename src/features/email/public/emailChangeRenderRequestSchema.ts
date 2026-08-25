import * as v from "valibot"
import { userEmailChangeDeliverySchema } from "../../users/public/userEmailChangeDeliverySchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

export const emailChangeRenderRequestSchema = v.strictObject({
  delivery: userEmailChangeDeliverySchema,
  footer: emailGeneratorFooterSchema,
  url: v.pipe(v.string(), v.minLength(1)),
})

export type EmailChangeRenderRequest = v.InferOutput<typeof emailChangeRenderRequestSchema>
