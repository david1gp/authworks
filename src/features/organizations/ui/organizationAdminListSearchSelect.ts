/** Reads the debounced organization directory search text from the URL query string. */
export function organizationAdminListSearchSelect(search: string): string {
  return new URLSearchParams(search).get("q") ?? ""
}
