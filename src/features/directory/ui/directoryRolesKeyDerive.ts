/**
 * Derives a backend-compatible project role key from a display name: lowercase,
 * diacritics stripped, runs of other characters collapsed to a single dash, with
 * no leading or trailing dashes. The result satisfies the key entry of
 * `projectRoleCreateRequestSchema` whenever it is non-empty.
 */
export function directoryRolesKeyDerive(displayName: string): string {
  return displayName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
