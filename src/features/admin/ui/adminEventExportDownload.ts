import type { Event as TenantEvent } from "../../events/public/eventSchema.js"

/** Downloads the exported audit events as JSON through a temporary object URL. */
export function adminEventExportDownload(items: readonly TenantEvent[]): void {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "authworks-events.json"
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
