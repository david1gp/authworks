import { productionNavigationItemActive } from "./productionNavigationItemActive.js"

/**
 * The single sidebar destination to highlight for `pathname`: the longest matching href, so a nested
 * destination such as `/admin/realm/administrators` wins over its `/admin/realm` parent instead of
 * both rows lighting up.
 */
export function productionNavigationActiveHrefSelect(hrefs: readonly string[], pathname: string): string | undefined {
  let best: string | undefined
  for (const href of hrefs) {
    if (!productionNavigationItemActive(href, pathname)) continue
    if (best === undefined || href.length > best.length) best = href
  }
  return best
}
