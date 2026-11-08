type ProductionRouteRedirectContext = {
  readonly currentOrganizationId: string | undefined
  readonly hash: string
  readonly organizations: readonly { readonly id: string; readonly slug?: string | undefined }[]
  readonly realmAdmin: boolean
  readonly search: string
}

/** First `/admin/<segment>` values that moved to realm scope; everything else under `/admin/` moved to org scope. */
const realmFirstSegments = new Set([
  "events",
  "login-policy",
  "oidc-clients",
  "oidc-consents",
  "protocol-documents",
  "sessions",
  "signing-keys",
  "whatsapp",
])

function productionRouteRedirectTargetComplete(target: string, search: string, hash: string): string {
  const withSearch = target.includes("?") || search === "" ? target : `${target}${search}`
  return withSearch.includes("#") || hash === "" ? withSearch : `${withSearch}${hash}`
}

/**
 * Client-side redirects from removed `/admin` routes (and bare `/orgs`) to their
 * `/orgs/{slug}` or `/realm` replacements. Returns undefined when the pathname renders as-is,
 * including unknown `/orgs/{slug}` paths (the route renders the inaccessible panel instead).
 */
export function productionRouteRedirectSelect(
  pathname: string,
  context: ProductionRouteRedirectContext,
): string | undefined {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname
  if (normalized === "/orgs" || normalized === "/admin") {
    if (context.realmAdmin) return productionRouteRedirectTargetComplete("/realm", context.search, context.hash)
    const defaultSlug = productionRouteRedirectDefaultSlug(context)
    if (defaultSlug === undefined) return undefined
    return productionRouteRedirectTargetComplete(`/orgs/${defaultSlug}`, context.search, context.hash)
  }
  if (normalized.startsWith("/orgs/") || normalized === "/realm" || normalized.startsWith("/realm/")) return undefined
  if (normalized.startsWith("/admin/") === false) return undefined

  const rest = normalized.slice("/admin/".length)
  const segments = rest.split("/")
  const first = segments[0] ?? ""
  if (first === "sign-in") {
    return segments.length === 1
      ? productionRouteRedirectTargetComplete("/realm/sign-in", context.search, context.hash)
      : undefined
  }
  if (first === "branding") {
    return productionRouteRedirectOrganizationTarget(context, "configuration/branding")
  }
  if (first === "configuration" && segments.length === 1) {
    return productionRouteRedirectOrganizationTarget(context, "configuration/general")
  }
  if (first === "domains") {
    return productionRouteRedirectOrganizationTarget(context, "configuration/domains")
  }
  if (first === "invitations") {
    return productionRouteRedirectOrganizationTarget(context, "users?tab=invitations")
  }
  if (first === "machine-users" && segments.length === 1) {
    return productionRouteRedirectOrganizationTarget(context, "users?tab=service-accounts")
  }
  if (first === "memberships") {
    return productionRouteRedirectOrganizationTarget(context, "users")
  }
  const projectMatch = /^projects\/([^/]+)\/(applications|roles-grants|effective-access)$/.exec(rest)
  if (projectMatch !== null) {
    const tab =
      projectMatch[2] === "applications" ? "applications" : projectMatch[2] === "roles-grants" ? "roles" : "access"
    return productionRouteRedirectOrganizationTarget(context, `projects/${projectMatch[1]}?tab=${tab}`)
  }
  if (first === "organizations" && segments.length > 1) {
    const slug = context.organizations.find((item) => item.id === segments[1])?.slug
    const defaultSlug = slug ?? productionRouteRedirectDefaultSlug(context)
    if (defaultSlug === undefined) return undefined
    return productionRouteRedirectTargetComplete(`/orgs/${defaultSlug}`, context.search, context.hash)
  }
  // Legacy realm paths already carry the `realm` segment (`/admin/realm/...`), so re-rooting
  // them only swaps the prefix; every other realm suffix gains the `/realm` prefix.
  if (first === "realm") return productionRouteRedirectTargetComplete(`/${rest}`, context.search, context.hash)
  if (first === "organizations" || realmFirstSegments.has(first)) {
    return productionRouteRedirectTargetComplete(`/realm/${rest}`, context.search, context.hash)
  }
  return productionRouteRedirectOrganizationTarget(context, rest)
}

function productionRouteRedirectDefaultSlug(context: ProductionRouteRedirectContext): string | undefined {
  if (context.currentOrganizationId === undefined) return undefined
  return context.organizations.find((item) => item.id === context.currentOrganizationId)?.slug
}

function productionRouteRedirectOrganizationTarget(
  context: ProductionRouteRedirectContext,
  suffix: string,
): string | undefined {
  const defaultSlug = productionRouteRedirectDefaultSlug(context)
  if (defaultSlug === undefined) return undefined
  return productionRouteRedirectTargetComplete(`/orgs/${defaultSlug}/${suffix}`, context.search, context.hash)
}
