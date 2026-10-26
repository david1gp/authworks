/**
 * Selects the browser URL of a project's proxied callback-origin favicon.
 * The endpoint is cookie-authenticated, so views render it in an `img` tag
 * and fall back when the project has no usable callback URLs.
 */
export function oidcProjectFaviconHrefSelect(options: {
  readonly baseUrl: string
  readonly projectId: string
  readonly realmId: string
}): string {
  const base = options.baseUrl.replace(/\/$/, "")
  return `${base}/realms/${encodeURIComponent(options.realmId)}/oidc/projects/${encodeURIComponent(options.projectId)}/favicon`
}
