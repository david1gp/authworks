const organizationSlugReserved = new Set(["new", "unassigned"])

/**
 * Suggests a URL-safe organization slug from an organization name: lowercase,
 * runs of anything outside `[a-z0-9]` become a single hyphen, leading/trailing
 * hyphens trimmed, capped at 64 characters. Returns "organization" when nothing
 * usable remains or the suggestion is reserved.
 */
export function organizationSlugSuggest(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64)
    .replace(/-+$/, "")
  if (slug.length === 0 || organizationSlugReserved.has(slug)) return "organization"
  return slug
}
