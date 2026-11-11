import type { SignalObject } from "#ui/utils/createSignalObject.js"
import type { AuthenticatedDataTableSort } from "./authenticatedDataTableSort.js"
export function authenticatedSortSelectStateCreate(options: {
  readonly sort: () => AuthenticatedDataTableSort
  readonly onSortChange: (sort: AuthenticatedDataTableSort) => void
}) {
  const valueSignal: SignalObject<string> = {
    get: () => options.sort().key,
    set: (key) => options.onSortChange({ ...options.sort(), key }),
  }
  return {
    valueSignal,
    toggle: () =>
      options.onSortChange({ ...options.sort(), direction: options.sort().direction === "asc" ? "desc" : "asc" }),
  }
}
