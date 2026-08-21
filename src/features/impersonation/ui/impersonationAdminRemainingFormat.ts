import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/** Formats the seconds left on an impersonation as a short, translated `m:ss` duration. */
export function impersonationAdminRemainingFormat(remainingSeconds: number): string {
  const bounded = Math.max(0, Math.floor(remainingSeconds))
  const minutes = Math.floor(bounded / 60)
  const seconds = bounded % 60
  return messageTranslate("admin.impersonation.remainingValue", {
    minutes: String(minutes),
    seconds: String(seconds).padStart(2, "0"),
  })
}
