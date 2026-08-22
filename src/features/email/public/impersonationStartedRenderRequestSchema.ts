import * as v from "valibot"
import { impersonationSecurityNotificationSchema } from "../../impersonation/public/impersonationSecurityNotificationSchema.js"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"

const notificationSchema = v.pipe(
  impersonationSecurityNotificationSchema,
  v.check((value) => value.kind === "started"),
)

export const impersonationStartedRenderRequestSchema = v.strictObject({
  footer: emailGeneratorFooterSchema,
  notification: notificationSchema,
})

export type ImpersonationStartedRenderRequest = v.InferOutput<typeof impersonationStartedRenderRequestSchema>
