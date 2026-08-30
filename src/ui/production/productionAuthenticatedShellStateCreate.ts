import { useLocation } from "@solidjs/router"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { accountSectionNavStateCreate } from "../../features/account/ui/accountSectionNavStateCreate.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { authenticatedSidebarDestinationSelect } from "../authenticated/authenticatedSidebarDestinationSelect.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { productionNavigationItemActive } from "./productionNavigationItemActive.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import { productionShellNavigationGroups } from "./productionShellNavigationGroups.js"
import { productionShellNavigationLinkVisible } from "./productionShellNavigationLinkVisible.js"

export function productionAuthenticatedShellStateCreate(
  kind: () => "account" | "admin" | "invitations",
  title: () => MessageKey,
) {
  const location = useLocation()
  const session = productionSessionContextGet()
  const sidebar = createSidebarState()
  const accountSections = accountSectionNavStateCreate()
  const organizationError = createSignalObject<string | undefined>(undefined)
  const organizationPending = createSignalObject(false)

  const organizationId = () => {
    session.organizationSwitchPending()
    return typeof session.guard.organization === "object" ? session.guard.organization.organizationId : ""
  }

  const organizationLabel = () => {
    const currentId = organizationId()
    const active = session.organizations.find((item) => item.id === currentId) ?? session.organizations[0]
    return active?.label ?? ""
  }

  return {
    accountSections: accountSections.items,
    actorInitial: () => session.actorLabel.trim().slice(0, 1).toUpperCase(),
    contentClass: () =>
      kind() !== "account" && sidebar.openDesktop.get() ? authenticatedNavigationClasses.contentOffset : "",
    destinationSelect: () => authenticatedSidebarDestinationSelect(sidebar),
    groups: () => productionShellNavigationGroups[kind()],
    homeHref: () => (kind() === "admin" ? "/admin" : "/account"),
    isAccountSectionActive: accountSections.isActive,
    isActive: (href: string) => productionNavigationItemActive(href, location.pathname),
    isContextual: () => kind() !== "account",
    organizationChange: (event: Event & { readonly currentTarget: HTMLSelectElement }) => {
      if (organizationPending.get() || session.organizationSwitchPending()) return
      organizationPending.set(true)
      organizationError.set(undefined)
      void session.organizationSelect(event.currentTarget.value).then((result) => {
        organizationPending.set(session.organizationSwitchPending())
        if (!result.success) organizationError.set(result.errorMessage)
      })
    },
    organizationId,
    organizationLabel,
    organizationError: organizationError.get,
    organizationSwitchPending: () => organizationPending.get() || session.organizationSwitchPending(),
    organizationSwitchable: () => session.organizations.length > 1,
    showAccountNavigation: () =>
      productionShellNavigationLinkVisible({ guard: session.guard, kind: kind(), target: "account" }),
    showAdminNavigation: () =>
      productionShellNavigationLinkVisible({ guard: session.guard, kind: kind(), target: "admin" }),
    session,
    sidebar,
    signOutHref: "/login/logout",
    title: () => messageTranslate("shell.nav.navigationTitle", { title: messageTranslate(title()) }),
  }
}
