import { useLocation } from "@solidjs/router"
import * as v from "valibot"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { authenticatedSidebarDestinationSelect } from "../authenticated/authenticatedSidebarDestinationSelect.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"
import { productionNavigationItemActive } from "./productionNavigationItemActive.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import { productionShellAccessPermits } from "./productionShellAccessPermits.js"
import { productionShellNavigationGroups } from "./productionShellNavigationGroups.js"
import { productionShellNavigationLinkVisible } from "./productionShellNavigationLinkVisible.js"

const realmGroupOpenSchema = v.optional(v.picklist(["open", "closed"]), "closed")

function realmGroupOpenStoredGet(rememberKey: string | undefined): boolean {
  if (rememberKey === undefined || typeof localStorage === "undefined") return false
  const parsed = v.safeParse(realmGroupOpenSchema, localStorage.getItem(rememberKey))
  return parsed.success && parsed.output === "open"
}

function realmGroupOpenStoredSet(rememberKey: string | undefined, open: boolean): void {
  if (rememberKey === undefined || typeof localStorage === "undefined") return
  try {
    localStorage.setItem(rememberKey, open ? "open" : "closed")
  } catch {
    // Browsers may block storage; the group simply falls back to closed.
  }
}

export function productionAuthenticatedShellStateCreate(
  kind: () => "account" | "admin" | "invitations",
  title: () => MessageKey,
) {
  const location = useLocation()
  const session = productionSessionContextGet()
  const sidebar = createSidebarState()
  const organizationError = createSignalObject<string | undefined>(undefined)
  const organizationPending = createSignalObject(false)
  const realmGroupManual = createSignalObject<boolean | undefined>(undefined)

  const organizationId = () => {
    session.organizationSwitchPending()
    return typeof session.guard.organization === "object" ? session.guard.organization.organizationId : ""
  }

  const organizationLabel = () => {
    if (kind() === "account") return ""
    const currentId = organizationId()
    const active = session.organizations.find((item) => item.id === currentId) ?? session.organizations[0]
    return active?.label ?? ""
  }

  const groupItemsVisible = (group: ProductionNavigationGroup) => {
    if (group.access !== undefined && session.guard.access !== "loading") {
      if (!productionShellAccessPermits(group.access, session.guard.access)) return []
    }
    return group.items.filter((item) => {
      if (item.access === undefined) return true
      if (session.guard.access === "loading") return false
      return productionShellAccessPermits(item.access, session.guard.access)
    })
  }

  const groups = () => {
    const visible: ProductionNavigationGroup[] = productionShellNavigationGroups[kind()]
      .map((group) => ({ ...group, items: groupItemsVisible(group) }))
      .filter((group) => group.items.length > 0)
    // Members without admin access see no admin navigation at all.
    if (kind() === "admin" && session.guard.access !== "loading") {
      const anyVisible = visible.some((group) => group.items.length > 0)
      if (!anyVisible) return []
    }
    return visible
  }

  const groupOpen = (group: Pick<ProductionNavigationGroup, "collapsible" | "items" | "rememberKey">) => {
    if (group.collapsible !== true) return true
    if (realmGroupManual.get() !== undefined) return realmGroupManual.get() as boolean
    if (group.items.some((item) => productionNavigationItemActive(item.href, location.pathname))) return true
    return realmGroupOpenStoredGet(group.rememberKey)
  }

  const groupToggle = (group: Pick<ProductionNavigationGroup, "collapsible" | "items" | "rememberKey">) => {
    const next = !groupOpen(group)
    realmGroupManual.set(next)
    realmGroupOpenStoredSet(group.rememberKey, next)
  }

  return {
    actorInitial: () => session.actorLabel.trim().slice(0, 1).toUpperCase(),
    contentClass: () =>
      kind() !== "account" && sidebar.openDesktop.get() ? authenticatedNavigationClasses.contentOffset : "",
    destinationSelect: () => authenticatedSidebarDestinationSelect(sidebar),
    groups,
    groupOpen,
    groupToggle,
    /** The rail's own collapse control is only meaningful on desktop; mobile uses the top bar. */
    collapseVisible: () => !sidebar.isMobile.get(),
    homeHref: () => (kind() === "admin" ? "/admin/users" : "/account"),
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
    organizationSwitchable: () => kind() !== "account" && session.organizations.length > 1,
    showAccountNavigation: () =>
      productionShellNavigationLinkVisible({ guard: session.guard, kind: kind(), target: "account" }),
    session,
    sidebar,
    signOutHref: "/login/logout",
    /** Slim top bar carrying the sidebar toggle; hidden while the desktop rail is open. */
    topBarVisible: () => sidebar.isMobile.get() || !sidebar.openDesktop.get(),
    title: () => messageTranslate("shell.nav.navigationTitle", { title: messageTranslate(title()) }),
  }
}
