const oidcFaviconCacheDefaultTtlMs = 7 * 24 * 60 * 60 * 1000

/**
 * Selects how long a fetched favicon stays cached: the upstream
 * `Cache-Control` age when configured (`s-maxage` wins over `max-age`,
 * `no-store` disables caching), else the `Expires` delta, else one week.
 */
export function oidcFaviconCacheTtlSelect(options: {
  readonly cacheControl: string | null
  readonly expires: string | null
  readonly now: number
}): number {
  const maxAge = oidcFaviconMaxAgeParse(options.cacheControl)
  if (maxAge !== undefined) return Math.max(0, maxAge * 1000)
  if (options.expires !== null) {
    const expiresAt = Date.parse(options.expires)
    if (!Number.isNaN(expiresAt)) return Math.max(0, expiresAt - options.now)
  }
  return oidcFaviconCacheDefaultTtlMs
}

function oidcFaviconMaxAgeParse(cacheControl: string | null): number | undefined {
  if (cacheControl === null) return undefined
  const directives = cacheControl.split(",").map((directive) => directive.trim().toLowerCase())
  if (directives.includes("no-store")) return 0
  for (const name of ["s-maxage", "max-age"]) {
    const directive = directives.find((entry) => entry.startsWith(`${name}=`))
    if (directive === undefined) continue
    const seconds = Number.parseInt(directive.slice(name.length + 1), 10)
    if (Number.isSafeInteger(seconds) && seconds >= 0) return seconds
  }
  return undefined
}
