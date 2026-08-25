import type { MessageKey } from "../i18n/model/messageKeySchema.js"

export type ProductionNavigationItem = {
  readonly href: string
  readonly icon: string
  readonly label: MessageKey
}
