import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import type { ProductionNavigationItem } from "./productionNavigationItem.js"
import type { ProductionRouteAccess } from "./productionRouteGuardRequirement.js"

export type ProductionNavigationGroup = {
  readonly access?: ProductionRouteAccess
  readonly label: MessageKey | null
  readonly scope: "organization" | "realm"
  readonly items: readonly ProductionNavigationItem[]
}
