import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import type { ProductionRouteAccess } from "./productionRouteGuardRequirement.js"

export type ProductionNavigationItem = {
  readonly href: string
  readonly icon: string
  readonly label: MessageKey
  readonly access?: ProductionRouteAccess
}
