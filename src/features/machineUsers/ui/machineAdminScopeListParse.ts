/**
 * Splits an operator-entered newline, comma, or space separated scope list into exact
 * entries. Scopes are matched exactly by the server, so entries are only trimmed and
 * de-duplicated; they are never normalised, lowercased, or expanded.
 */
export function machineAdminScopeListParse(value: string): readonly string[] {
  const entries = value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return [...new Set(entries)]
}
