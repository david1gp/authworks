/**
 * Organization administration base path for the current URL. The URL slug is the source of
 * truth (it always matches the selected organization after a switch navigates first); the
 * guard-selected organization covers realm pages and transient states. With no slug at all
 * the realm root keeps links routable instead of pointing at a made-up organization.
 */
export function productionOrganizationBasePathGet(options: {
  readonly organizationId: string | undefined
  readonly organizations: readonly { readonly id: string; readonly slug?: string | undefined }[]
  readonly pathname: string
}): string {
  const segments = options.pathname.split("/").filter((segment) => segment.length > 0)
  const pathSlug =
    segments[0] === "orgs" && segments[1] !== undefined && segments[1].length > 0 ? segments[1] : undefined
  const guardSlug =
    options.organizationId === undefined
      ? undefined
      : options.organizations.find((item) => item.id === options.organizationId)?.slug
  const slug = pathSlug ?? guardSlug
  return slug === undefined ? "/realm" : `/orgs/${slug}`
}
