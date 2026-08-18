import { errorCatalog } from "./errorCatalog.js"
import type { ErrorCatalogEntry } from "./errorCatalogEntrySchema.js"

export function errorCatalogGet(code: string): ErrorCatalogEntry | undefined {
  return errorCatalog.find((entry) => entry.code === code)
}
