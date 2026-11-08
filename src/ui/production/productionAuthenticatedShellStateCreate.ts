import { useLocation, useNavigate } from "@solidjs/router"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { authenticatedSidebarDestinationSelect } from "../authenticated/authenticatedSidebarDestinationSelect.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { productionNavigationActiveHrefSelect } from "./productionNavigationActiveHrefSelect.js"
import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"
import { productionNavigationItemActive } from "./productionNavigationItemActive.js"
import { productionOrganizationBasePathGet } from "./productionOrganizationBasePathGet.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import { productionShellAccessPermits } from "./productionShellAccessPermits.js"
import { productionShellNavigationGroupsCreate } from "./productionShellNavigationGroupsCreate.js"
import { productionShellNavigationLinkVisible } from "./productionShellNavigationLinkVisible.js"

const realmDefaultHref = "/realm"

/** The shell scope follows the URL prefix; realm administrators see realm links under `/realm`. */
function adminScopeSelect(pathname: string): "organization" | "realm" {
  return pathname === "/realm" || pathname.startsWith("/realm/") ? "realm" : "organization"
}

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

  const organizationId = () => {
    session.organizationSwitchPending()
    return typeof session.guard.organization === "object" ? session.guard.organization.organizationId : ""
  }

  const activeOrganization = () =>
    session.organizations.find((item) => item.id === organizationId()) ?? session.organizations[0]

  /** URL slug first (source of truth), then the guard-selected org, then the first membership. */
  const organizationSlug = () => {
    const segments = location.pathname.split("/").filter((segment) => segment.length > 0)
    if (segments[0] === "orgs" && segments[1] !== undefined && segments[1].length > 0) return segments[1]
    return activeOrganization()?.slug ?? session.organizations[0]?.slug ?? ""
  }

  const organizationBasePath = () => `/orgs/${organizationSlug()}`
  const organizationHomeHref = () => `${organizationBasePath()}/users`

  const realmLabel = () => {
    if (kind() === "account") return ""
    return session.realms[0]?.label ?? ""
  }

  const realmId = () => session.realms[0]?.id ?? ""

  const canAccessRealm = () => session.guard.access !== "loading" && session.guard.access.realmAdministrator === true

  const navigationGroups = () => productionShellNavigationGroupsCreate(organizationSlug())

  const realmHrefs = () =>
    navigationGroups()
      .admin.filter((group) => group.scope === "realm")
      .flatMap((group) => group.items.map((item) => item.href))

  const organizationHrefs = () =>
    navigationGroups()
      .admin.filter((group) => group.scope === "organization")
      .flatMap((group) => group.items.map((item) => item.href))

  const isRealmPath = (pathname: string) => realmHrefs().some((href) => productionNavigationItemActive(href, pathname))

  const isOrganizationPath = (pathname: string) =>
    organizationHrefs().some((href) => productionNavigationItemActive(href, pathname))

  const adminScope = (): "organization" | "realm" => {
    if (kind() !== "admin") return "organization"
    if (!canAccessRealm()) return "organization"
    return adminScopeSelect(location.pathname)
  }

  const adminScopeSelectNavigate = (next: "organization" | "realm") => {
    if (kind() !== "admin") return
    if (next === "realm" && !canAccessRealm()) return
    if (next === "realm") {
      if (!isRealmPath(location.pathname)) navigate(realmDefaultHref)
      return
    }
    if (!isOrganizationPath(location.pathname)) navigate(organizationHomeHref())
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
        ? navigationGroups().admin.filter((group) => group.scope === adminScope())
        : navigationGroups()[kind()]
    const visible: ProductionNavigationGroup[] = scopeFiltered
      .map((group) => ({ ...group, items: groupItemsVisible(group) }))
      .filter((group) => group.items.length > 0)
    // Members without admin access only see the member-open destinations (the users
    // surface, scoped by the view and the server).
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
    adminScopeSelect: adminScopeSelectNavigate,
    canAccessRealm,
    contentClass: () =>
      kind() !== "account" && sidebar.openDesktop.get() ? authenticatedNavigationClasses.contentOffset : "",
    destinationSelect: () => authenticatedSidebarDestinationSelect(sidebar),
    groups,
    /** The rail's own collapse control is only meaningful on desktop; mobile uses the top bar. */
    collapseVisible: () => !sidebar.isMobile.get(),
    homeHref: () => {
      if (kind() !== "admin") return "/account"
      if (organizationSlug().length > 0) return organizationHomeHref()
      return canAccessRealm() ? realmDefaultHref : "/account"
    },
    /** Only the most specific grouped destination is highlighted. */
    isItemActive: (href: string) => activeHref() === href,
    isContextual: () => kind() !== "account",
    organizationSelect: (nextOrganizationId: string) => {
      const nextSlug = session.organizations.find((item) => item.id === nextOrganizationId)?.slug
      if (nextSlug !== undefined) {
        const target = isOrganizationPath(location.pathname)
          ? location.pathname.replace(/^\/orgs\/[^/]+/, `/orgs/${nextSlug}`)
          : `/orgs/${nextSlug}`
        const suffix = isOrganizationPath(location.pathname) ? `${location.search}${location.hash}` : ""
        navigate(`${target}${suffix}`)
      }
      if (nextOrganizationId === organizationId()) return
      if (organizationPending.get() || session.organizationSwitchPending()) return
      organizationPending.set(true)
      organizationError.set(undefined)
      void session.organizationSelect(nextOrganizationId).then((result) => {
        organizationPending.set(session.organizationSwitchPending())
        if (!result.success) organizationError.set(result.errorMessage)
      })
    },
    activeOrganization,
    organizationId,
    /** Organization base path for callers that cannot read the route param directly. */
    organizationBasePath: () =>
      productionOrganizationBasePathGet({
        organizationId: organizationId() === "" ? undefined : organizationId(),
        organizations: session.organizations,
        pathname: location.pathname,
      }),
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
