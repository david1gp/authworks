import * as v from "valibot"
import { impersonationSecurityNotificationSchema } from "../../impersonation/public/impersonationSecurityNotificationSchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

const notificationSchema = v.pipe(
  impersonationSecurityNotificationSchema,
  v.check((value) => value.kind === "ended"),
)

export const impersonationEndedRenderRequestSchema = v.strictObject({
  footer: emailGeneratorFooterSchema,
  notification: notificationSchema,
})

export type ImpersonationEndedRenderRequest = v.InferOutput<typeof impersonationEndedRenderRequestSchema>
