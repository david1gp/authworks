import * as v from "valibot"

export const externalIdentityAppleNotificationResponseSchema = v.strictObject({ received: v.literal(true) })

export type ExternalIdentityAppleNotificationResponse = v.InferOutput<
  typeof externalIdentityAppleNotificationResponseSchema
>
