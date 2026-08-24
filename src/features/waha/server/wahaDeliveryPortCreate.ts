import { messageTextSend } from "@adaptive-ds/waha-client"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { WahaDeliveryPort } from "../domain/wahaDeliveryPort.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"

type WahaDeliveryPortCreateOptions = {
  readonly configuration: WahaConfiguration
}

export function wahaDeliveryPortCreate(options: WahaDeliveryPortCreateOptions): WahaDeliveryPort {
  return {
    async sendText(input) {
      const op = "wahaDeliveryPortSendText"
      const endpoint = options.configuration.endpoints.find((candidate) => candidate.id === input.endpointId)
      if (endpoint === undefined)
        return resultErrorCodedCreate(op, "The configured WAHA endpoint was not found.", "waha.not-found")

      try {
        const sent = await messageTextSend({
          chatId: input.chatId,
          config: endpoint.client,
          session: input.sessionName,
          text: input.text,
        })
        if (!sent.success)
          return resultErrorCodedCreate(op, "The WhatsApp message could not be delivered.", "waha.delivery-failed")
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCodedCreate(op, "The WhatsApp message could not be delivered.", "waha.delivery-failed")
      }
    },
  }
}
