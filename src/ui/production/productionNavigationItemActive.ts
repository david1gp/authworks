export function productionNavigationItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === pathname) return true
  if (itemHref === "/account" || itemHref === "/orgs" || itemHref === "/realm") return false
  return pathname.startsWith(`${itemHref}/`)
}
