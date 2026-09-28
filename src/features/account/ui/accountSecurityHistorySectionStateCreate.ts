import type { Accessor } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountSecurityHistoryItem } from "../public/accountSecurityHistoryItemSchema.js"

/** The card count describes only the events loaded so far, not all pages. */
export function accountSecurityHistorySectionStateCreate(history: Accessor<readonly AccountSecurityHistoryItem[]>) {
  return {
    summaryStatus: () =>
      messageTranslate(history().length > 0 ? "account.status.available" : "account.securityHistory.empty"),
    summaryValue: () =>
      messageTranslate(
        history().length === 1 ? "account.securityHistory.countOneShown" : "account.securityHistory.countShown",
        {
          count: history().length,
        },
      ),
  }
}
