import { useLocation } from "@solidjs/router"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { productionNavigationItemActive } from "./productionNavigationItemActive.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import { productionShellNavigationGroups } from "./productionShellNavigationGroups.js"

export function productionAuthenticatedShellStateCreate(kind: () => "account" | "admin" | "invitations") {
  const location = useLocation()
  const session = productionSessionContextGet()
  const sidebar = createSidebarState()

  return {
    groups: () => productionShellNavigationGroups[kind()],
    isActive: (href: string) => productionNavigationItemActive(href, location.pathname),
    organizationId: () =>
      typeof session.guard.organization === "object" ? session.guard.organization.organizationId : "",
    realmId: () => (typeof session.guard.realm === "object" ? session.guard.realm.realmId : ""),
    session,
    sidebar,
  }
}
