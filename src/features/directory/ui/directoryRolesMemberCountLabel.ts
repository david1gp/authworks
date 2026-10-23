import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/** Member count label with a dedicated singular form. */
export function directoryRolesMemberCountLabel(count: number): string {
  if (count === 1) return messageTranslate("admin.roles.memberCountOne")
  return messageTranslate("admin.roles.memberCount", { count })
}
