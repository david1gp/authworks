import type { UserExportResponse } from "../../users/public/userExportResponseSchema.js"

/**
 * Saves an account export as a JSON file download. The export endpoint is secret-free by
 * construction, so the serialized payload is safe to write to disk.
 */
export function accountExportFileDownload(data: UserExportResponse): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "authworks-account-export.json"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
