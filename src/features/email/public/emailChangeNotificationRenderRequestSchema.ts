import * as v from "valibot"
import { userEmailChangeNotificationSchema } from "../../users/public/userEmailChangeNotificationSchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

export const emailChangeNotificationRenderRequestSchema = v.strictObject({
  footer: emailGeneratorFooterSchema,
  notification: userEmailChangeNotificationSchema,
})

export type EmailChangeNotificationRenderRequest = v.InferOutput<typeof emailChangeNotificationRenderRequestSchema>
