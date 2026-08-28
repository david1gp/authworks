import { authenticatedNavigationClasses } from "./authenticatedNavigationClasses.js"

/** Full class string for one compact navigation row in its active or inactive tone. */
export function authenticatedNavigationLinkClassGet(active: boolean) {
  const tone = active ? authenticatedNavigationClasses.linkActive : authenticatedNavigationClasses.linkInactive
  return `${authenticatedNavigationClasses.link} ${tone}`
}
