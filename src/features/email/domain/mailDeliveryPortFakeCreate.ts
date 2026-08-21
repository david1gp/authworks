import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { MailDeliveryMessage } from "./mailDeliveryMessage.js"
import type { MailDeliveryPort } from "./mailDeliveryPort.js"

export function mailDeliveryPortFakeCreate(): {
  readonly messages: MailDeliveryMessage[]
  readonly port: MailDeliveryPort
} {
  const messages: MailDeliveryMessage[] = []
  return {
    messages,
    port: {
      async deliver(message) {
        messages.push(message)
        return resultCreate(undefined)
      },
    },
  }
}
