import { errorCatalog } from "./errorCatalog.js"
import type { ErrorCatalogEntry } from "./errorCatalogEntrySchema.js"

export function errorCatalogEntries(): readonly ErrorCatalogEntry[] {
  return errorCatalog
}
