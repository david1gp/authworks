import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import type { ProductionNavigationItem } from "./productionNavigationItem.js"

export type ProductionNavigationGroup = {
  readonly label: MessageKey
  readonly items: readonly ProductionNavigationItem[]
}
