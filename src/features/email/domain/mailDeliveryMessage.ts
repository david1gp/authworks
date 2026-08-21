import type { EmailRenderedMessage } from "../public/emailRenderedMessageSchema.js"

export type MailDeliveryMessage = {
  readonly message: EmailRenderedMessage
  readonly to: string
}
