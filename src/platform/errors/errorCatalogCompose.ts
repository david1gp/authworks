import type { ErrorCatalogEntry } from "./errorCatalogEntrySchema.js"

export function errorCatalogCompose(
  ...catalogs: readonly (readonly ErrorCatalogEntry[])[]
): readonly ErrorCatalogEntry[] {
  return catalogs.flat()
}
