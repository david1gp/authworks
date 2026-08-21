/**
 * Splits an operator-entered newline or comma separated list into exact entries.
 * Redirect URIs and scopes are matched exactly by the server, so entries are only
 * trimmed and de-duplicated; they are never normalised, lowercased, or wildcarded.
 */
export function oidcAdminUriListParse(value: string): readonly string[] {
  const entries = value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return [...new Set(entries)]
}
