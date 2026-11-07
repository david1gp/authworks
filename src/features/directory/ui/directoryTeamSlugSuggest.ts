/**
 * Suggests a URL-safe team slug from a team name: lowercase, runs of anything
 * outside `[a-z0-9]` become a single hyphen, leading/trailing hyphens trimmed,
 * capped at 64 characters. Returns "" when nothing usable remains.
 */
export function directoryTeamSlugSuggest(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
  return slug.slice(0, 64).replace(/-+$/, "")
}
