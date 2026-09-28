import type { Accessor } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { SessionMe } from "../../sessions/public/sessionMeSchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/** Only still-visible sessions can have an open detail dialog. */
export function accountSessionsSectionStateCreate(sessions: Accessor<readonly SessionMe[]>) {
  const selectedId = createSignalObject<string | undefined>(undefined)
  const dialogOpen = (id: string) => selectedId.get() === id && sessions().some((session) => session.id === id)
  const dialogOpenChange = (id: string, open: boolean) => {
    if (open) {
      if (sessions().some((session) => session.id === id)) selectedId.set(id)
      return
    }
    if (selectedId.get() === id) selectedId.set(undefined)
  }
  const sessionRevoke = (id: string, revoke: (id: string) => Promise<void>) => {
    if (!dialogOpen(id) || !sessions().some((session) => session.id === id && !session.current)) return
    void revoke(id)
  }

  const summaryStatus = () =>
    messageTranslate(
      sessions().some((session) => session.current)
        ? "account.sessions.current"
        : sessions().length > 0
          ? "account.status.available"
          : "account.sessions.empty",
    )

  return {
    dialogOpen,
    dialogOpenChange,
    sessionRevoke,
    summaryStatus,
    summaryTone: () => (sessions().some((session) => session.current) ? ("success" as const) : ("neutral" as const)),
    summaryValue: () =>
      messageTranslate(sessions().length === 1 ? "account.sessions.countOne" : "account.sessions.count", {
        count: sessions().length,
      }),
  }
}
