type OidcFaviconOriginSource = {
  readonly additionalOrigins: readonly string[]
  readonly postLogoutRedirectUris: readonly string[]
  readonly redirectUris: readonly string[]
}

/**
 * Selects the origin used for a client's favicon: the first http(s) redirect
 * URI origin, falling back to post-logout redirect URIs then additional
 * origins. Returns undefined when nothing usable is configured, so callers
 * render their fallback instead of a broken image.
 */
export function oidcFaviconOriginSelect(source: OidcFaviconOriginSource): string | undefined {
  for (const candidate of [...source.redirectUris, ...source.postLogoutRedirectUris, ...source.additionalOrigins]) {
    const origin = oidcFaviconOriginNormalize(candidate)
    if (origin !== undefined) return origin
  }
  return undefined
}

function oidcFaviconOriginNormalize(candidate: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch (_error) {
    return undefined
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined
  if (parsed.username.length > 0 || parsed.password.length > 0) return undefined
  if (parsed.origin === "null") return undefined
  return parsed.origin
}
