/** Reads a `:param` segment out of a matched production screen path. */
export function productionRouteParamGet(pattern: string, pathname: string, name: string): string | undefined {
  const patternParts = pattern.split("/").filter(Boolean)
  const pathnameParts = pathname.split("/").filter(Boolean)
  if (patternParts.length !== pathnameParts.length) return undefined
  const index = patternParts.indexOf(`:${name}`)
  if (index < 0) return undefined
  return pathnameParts[index]
}
