import { useLocation } from "@solidjs/router"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { authenticatedSidebarDestinationSelect } from "../authenticated/authenticatedSidebarDestinationSelect.js"
import { productionNavigationItemActive } from "./productionNavigationItemActive.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import { productionShellNavigationGroups } from "./productionShellNavigationGroups.js"
import { productionShellNavigationLinkVisible } from "./productionShellNavigationLinkVisible.js"

export function productionAuthenticatedShellStateCreate(kind: () => "account" | "admin" | "invitations") {
  const location = useLocation()
  const session = productionSessionContextGet()
  const sidebar = createSidebarState()

  const organizationId = () =>
    typeof session.guard.organization === "object" ? session.guard.organization.organizationId : ""

  return {
    actorInitial: () => session.actorLabel.trim().slice(0, 1).toUpperCase(),
    destinationSelect: () => authenticatedSidebarDestinationSelect(sidebar),
    groups: () => productionShellNavigationGroups[kind()],
    isActive: (href: string) => productionNavigationItemActive(href, location.pathname),
    navigationHidden: () => (sidebar.isMobile.get() ? !sidebar.openMobile.get() : !sidebar.openDesktop.get()),
    organizationLabel: () =>
      session.organizations.find((organization) => organization.id === organizationId())?.label ?? "",
    organizationId,
    organizationSwitchable: () => session.organizations.length > 1,
    showAccountNavigation: () =>
      productionShellNavigationLinkVisible({ guard: session.guard, kind: kind(), target: "account" }),
    showAdminNavigation: () =>
      productionShellNavigationLinkVisible({ guard: session.guard, kind: kind(), target: "admin" }),
    session,
    sidebar,
    signOutHref: "/login/logout",
  }
}
