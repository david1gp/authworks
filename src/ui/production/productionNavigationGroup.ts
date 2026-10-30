import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import type { ProductionNavigationItem } from "./productionNavigationItem.js"

export type ProductionNavigationGroup = {
  readonly access?: "organization-admin" | "realm-admin"
  readonly label: MessageKey | null
  readonly scope: "organization" | "realm"
  readonly items: readonly ProductionNavigationItem[]
}
