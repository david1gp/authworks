export function productionLoginRedirectUrlCreate(location: Pick<Location, "hash" | "pathname" | "search">): string {
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  return `/login?return_to=${encodeURIComponent(returnTo)}`
}
