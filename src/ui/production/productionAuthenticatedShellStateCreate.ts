import { useLocation, useNavigate } from "@solidjs/router"
import * as v from "valibot"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { authenticatedSidebarDestinationSelect } from "../authenticated/authenticatedSidebarDestinationSelect.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { productionNavigationActiveHrefSelect } from "./productionNavigationActiveHrefSelect.js"
import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"
import { productionNavigationItemActive } from "./productionNavigationItemActive.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import { productionShellAccessPermits } from "./productionShellAccessPermits.js"
import { productionShellNavigationGroups } from "./productionShellNavigationGroups.js"
import { productionShellNavigationLinkVisible } from "./productionShellNavigationLinkVisible.js"

const adminScopeSchema = v.optional(v.picklist(["organization", "realm"]), "organization")

const adminScopeStorageKey = "authworks.admin.scope"

function adminScopeStoredGet(): "organization" | "realm" {
  if (typeof localStorage === "undefined") return "organization"
  const parsed = v.safeParse(adminScopeSchema, localStorage.getItem(adminScopeStorageKey))
  return parsed.success ? parsed.output : "organization"
}

function adminScopeStoredSet(scope: "organization" | "realm"): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(adminScopeStorageKey, scope)
  } catch {
    // Browsers may block storage; the scope simply falls back to organization.
  }
}

const realmDefaultHref = "/admin/realm"
const organizationDefaultHref = "/admin/users"

export function productionAuthenticatedShellStateCreate(
  kind: () => "account" | "admin" | "invitations",
  title: () => MessageKey,
) {
  const location = useLocation()
  const navigate = useNavigate()
  const session = productionSessionContextGet()
  const sidebar = createSidebarState()
  const organizationError = createSignalObject<string | undefined>(undefined)
  const organizationPending = createSignalObject(false)
  const manualScope = createSignalObject<"organization" | "realm">(adminScopeStoredGet())

  const organizationId = () => {
    session.organizationSwitchPending()
    return typeof session.guard.organization === "object" ? session.guard.organization.organizationId : ""
  }

  const activeOrganization = () =>
    session.organizations.find((item) => item.id === organizationId()) ?? session.organizations[0]

  const realmLabel = () => {
    if (kind() === "account") return ""
    return session.realms[0]?.label ?? ""
  }

  const realmId = () => session.realms[0]?.id ?? ""

  const canAccessRealm = () => session.guard.access !== "loading" && session.guard.access.realmAdministrator === true

  const realmHrefs = () =>
    productionShellNavigationGroups.admin
      .filter((group) => group.scope === "realm")
      .flatMap((group) => group.items.map((item) => item.href))

  const organizationHrefs = () =>
    productionShellNavigationGroups.admin
      .filter((group) => group.scope === "organization")
      .flatMap((group) => group.items.map((item) => item.href))

  const isRealmPath = (pathname: string) => realmHrefs().some((href) => productionNavigationItemActive(href, pathname))

  const isOrganizationPath = (pathname: string) =>
    organizationHrefs().some((href) => productionNavigationItemActive(href, pathname))

  const adminScope = (): "organization" | "realm" => {
    if (kind() !== "admin") return "organization"
    if (!canAccessRealm()) return "organization"
    if (isRealmPath(location.pathname)) return "realm"
    if (isOrganizationPath(location.pathname)) return "organization"
    return manualScope.get()
  }

  const adminScopeSelect = (next: "organization" | "realm") => {
    if (kind() !== "admin") return
    if (next === "realm" && !canAccessRealm()) return
    manualScope.set(next)
    adminScopeStoredSet(next)
    if (next === "realm") {
      if (!isRealmPath(location.pathname)) navigate(realmDefaultHref)
      return
    }
    if (!isOrganizationPath(location.pathname)) navigate(organizationDefaultHref)
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
    const scopeFiltered =
      kind() === "admin"
        ? productionShellNavigationGroups[kind()].filter((group) => group.scope === adminScope())
        : productionShellNavigationGroups[kind()]
    const visible: ProductionNavigationGroup[] = scopeFiltered
      .map((group) => ({ ...group, items: groupItemsVisible(group) }))
      .filter((group) => group.items.length > 0)
    // Members without admin access see no admin navigation at all.
    if (kind() === "admin" && session.guard.access !== "loading") {
      const anyVisible = visible.some((group) => group.items.length > 0)
      if (!anyVisible) return []
    }
    return visible
  }

  const activeHref = () =>
    productionNavigationActiveHrefSelect(
      groups().flatMap((group) => group.items.map((item) => item.href)),
      location.pathname,
    )

  return {
    adminScope,
    adminScopeSelect,
    canAccessRealm,
    contentClass: () =>
      kind() !== "account" && sidebar.openDesktop.get() ? authenticatedNavigationClasses.contentOffset : "",
    destinationSelect: () => authenticatedSidebarDestinationSelect(sidebar),
    groups,
    /** The rail's own collapse control is only meaningful on desktop; mobile uses the top bar. */
    collapseVisible: () => !sidebar.isMobile.get(),
    homeHref: () => (kind() === "admin" ? "/admin/users" : "/account"),
    /** Only the most specific grouped destination is highlighted. */
    isItemActive: (href: string) => activeHref() === href,
    isContextual: () => kind() !== "account",
    organizationSelect: (nextOrganizationId: string) => {
      if (manualScope.get() !== "organization") {
        manualScope.set("organization")
        adminScopeStoredSet("organization")
      }
      if (organizationPending.get() || session.organizationSwitchPending()) return
      organizationPending.set(true)
      organizationError.set(undefined)
      void session.organizationSelect(nextOrganizationId).then((result) => {
        organizationPending.set(session.organizationSwitchPending())
        if (!result.success) organizationError.set(result.errorMessage)
      })
      if (!isOrganizationPath(location.pathname)) navigate(organizationDefaultHref)
    },
    activeOrganization,
    organizationId,
    realmId,
    realmLabel,
    organizationError: organizationError.get,
    organizationSwitchPending: () => organizationPending.get() || session.organizationSwitchPending(),
    organizationSwitchable: () => kind() !== "account" && (session.organizations.length > 1 || canAccessRealm()),
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
