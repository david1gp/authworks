import type { ProductionNavigationItem } from "./productionNavigationItem.js"

export type ProductionNavigationGroup = {
  readonly label: string
  readonly items: readonly ProductionNavigationItem[]
}
