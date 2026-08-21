import type { Result } from "#result"
import type { MailDeliveryMessage } from "./mailDeliveryMessage.js"

export type MailDeliveryPort = {
  readonly deliver: (message: MailDeliveryMessage) => Promise<Result<void>>
}
