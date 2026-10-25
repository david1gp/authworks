import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { sessionUserAgentParse } from "../domain/sessionUserAgentParse.js"

/** Resolves the display label for a session device, preferring an explicit description. */
export function sessionDeviceLabelGet(device: {
  readonly description?: string | undefined
  readonly userAgent?: string | undefined
}): string {
  const description = device.description?.trim()
  if (description !== undefined && description.length > 0) return description
  const userAgent = device.userAgent?.trim()
  if (userAgent === undefined || userAgent.length === 0) return messageTranslate("account.sessions.unknownDevice")
  const parsed = sessionUserAgentParse(userAgent)
  if (parsed.browser !== null && parsed.os !== null)
    return messageTranslate("account.sessions.deviceLabel", { browser: parsed.browser, os: parsed.os })
  if (parsed.browser !== null)
    return messageTranslate("account.sessions.deviceLabelBrowser", { browser: parsed.browser })
  if (parsed.os !== null) return messageTranslate("account.sessions.deviceLabelOs", { os: parsed.os })
  return messageTranslate("account.sessions.unknownDevice")
}
