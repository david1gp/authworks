import { createMemo } from "solid-js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AdminActivityAdapter } from "./adminActivityAdapter.js"
import { adminActivityStateCreate } from "./adminActivityStateCreate.js"
import { adminEventPayloadDisplay } from "./adminEventPayloadDisplay.js"

export function adminActivityViewStateCreate(options: {
  readonly adapter: AdminActivityAdapter
  readonly realmId: () => string
  readonly organizationId: () => string | undefined
  readonly contextLabel: () => string
}) {
  const page = adminActivityStateCreate(options)
  const words = (value: string) => {
    const text = value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ")
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  const rows = createMemo(() =>
    page.events().map((event) => ({
      id: event.id,
      label: words(event.eventType),
      subject: words(event.aggregateType),
      actor:
        event.actorId === undefined
          ? messageTranslate("admin.events.systemActor")
          : messageTranslate("admin.activity.actor", {
              actor:
                event.actorId.length > 24 ? `${event.actorId.slice(0, 8)}…${event.actorId.slice(-4)}` : event.actorId,
            }),
      actorId: event.actorId,
      timestamp: localeDateFormat(event.occurredAt, { dateStyle: "medium", timeStyle: "short" }),
      datetime: new Date(event.occurredAt).toISOString(),
      details: adminEventPayloadDisplay(event.payload),
    })),
  )
  return {
    ...page,
    rows,
    contextLabel: options.contextLabel,
    scope: () =>
      messageTranslate(options.organizationId() === undefined ? "admin.activity.realm" : "admin.activity.organization"),
    panelState: (): "loading" | "empty" | "error" | "inaccessible" => {
      const status = page.status()
      if (status === "permission-denied") return "inaccessible"
      return status === "ready" ? "empty" : status
    },
    panelDetail: () =>
      page.status() === "loading"
        ? undefined
        : messageTranslate(
            page.status() === "empty"
              ? "admin.activity.empty"
              : page.status() === "permission-denied"
                ? "admin.common.permission"
                : "admin.activity.error",
          ),
    count: () => messageTranslate("admin.events.count", { count: page.events().length }),
  }
}
