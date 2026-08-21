import type { ProductionRouteContract } from "./productionRouteContract.js"

export function productionRouteScreenSelect(route: ProductionRouteContract, pathname: string) {
  return route.screens.find((candidate) => productionRouteScreenMatches(candidate.path, pathname))
}

function productionRouteScreenMatches(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split("/").filter(Boolean)
  const pathnameParts = pathname.split("/").filter(Boolean)
  if (patternParts.length !== pathnameParts.length) return false
  return patternParts.every((part, index) => part.startsWith(":") || part === pathnameParts[index])
}
