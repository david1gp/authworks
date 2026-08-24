import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { PasswordWhatsappAvailabilityPort } from "./passwordWhatsappAvailabilityPort.js"

export function passwordWhatsappAvailabilityDenyByDefaultCreate(): PasswordWhatsappAvailabilityPort {
  return {
    whatsappOtpAvailabilityGet: () => resultCreate({ available: false }),
  }
}
