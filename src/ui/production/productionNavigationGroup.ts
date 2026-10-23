import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import type { ProductionNavigationItem } from "./productionNavigationItem.js"

export type ProductionNavigationGroup = {
  readonly access?: "organization-admin" | "realm-admin"
  readonly collapsible?: boolean
  readonly icon?: string
  readonly label: MessageKey | null
  readonly rememberKey?: string
  readonly items: readonly ProductionNavigationItem[]
}
