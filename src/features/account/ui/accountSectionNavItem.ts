import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"

export interface AccountSectionNavItem {
  readonly href: string
  readonly icon: string
  readonly id: string
  readonly label: MessageKey
}
