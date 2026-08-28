import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/** Returns the translated label of a stored gender value, falling back to the raw stored value. */
export function accountGenderValueText(value: string): string {
  if (value === "unspecified") return messageTranslate("account.profile.gender.unspecified")
  if (value === "woman") return messageTranslate("account.profile.gender.woman")
  if (value === "man") return messageTranslate("account.profile.gender.man")
  if (value === "non-binary") return messageTranslate("account.profile.gender.nonBinary")
  return value
}
