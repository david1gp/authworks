import { mdiAccountMultipleOutline } from "@adaptive-ds/mdi/mdiAccountMultipleOutline.js"
import { mdiAccountStarOutline } from "@adaptive-ds/mdi/mdiAccountStarOutline.js"
import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiCheckDecagramOutline } from "@adaptive-ds/mdi/mdiCheckDecagramOutline.js"
import { mdiClipboardTextOutline } from "@adaptive-ds/mdi/mdiClipboardTextOutline.js"
import { mdiCogOutline } from "@adaptive-ds/mdi/mdiCogOutline.js"
import { mdiDomain } from "@adaptive-ds/mdi/mdiDomain.js"
import { mdiFileDocumentOutline } from "@adaptive-ds/mdi/mdiFileDocumentOutline.js"
import { mdiKeyChain } from "@adaptive-ds/mdi/mdiKeyChain.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { mdiOpenid } from "@adaptive-ds/mdi/mdiOpenid.js"
import { mdiShieldCrownOutline } from "@adaptive-ds/mdi/mdiShieldCrownOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { useLocation } from "@solidjs/router"
import * as v from "valibot"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedSidebarDestinationSelect } from "../../../ui/authenticated/authenticatedSidebarDestinationSelect.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { productionShellAccessPermits } from "../../../ui/production/productionShellAccessPermits.js"
import { productionShellAccessResolve } from "../../../ui/production/productionShellAccessResolve.js"

const demoAccessSchema = v.optional(v.picklist(["owner", "admin", "realm-admin"]), "realm-admin")

export type AdminDemoAccess = v.InferOutput<typeof demoAccessSchema>

/** Validated demo `?as=` role: owner/admin drive organization-admin visibility, realm-admin sees all. */
export function adminDemoAccessSelect(search: string): AdminDemoAccess {
  const parsed = v.safeParse(demoAccessSchema, new URLSearchParams(search).get("as"))
  return parsed.success ? parsed.output : "realm-admin"
}

export type AdminDemoNavItem = {
  readonly href: string
  readonly icon: string
  readonly label: string
  readonly access: "organization-admin" | "realm-admin"
}

export type AdminDemoNavGroup = {
  readonly collapsible?: boolean
  readonly icon?: string
  readonly label: string | null
  readonly access?: "organization-admin" | "realm-admin"
  readonly items: readonly AdminDemoNavItem[]
}

/**
 * Demo navigation mirroring the production administration shell: organization items
 * top-level, realm items in a collapsed group. Visibility follows `?as=`.
 */
const demoNavigationGroups: readonly AdminDemoNavGroup[] = [
  {
    label: null,
    items: [
      { access: "organization-admin", href: "/demo/admin/users", icon: mdiAccountMultipleOutline, label: "Users" },
      { access: "organization-admin", href: "/demo/admin/roles", icon: mdiAccountStarOutline, label: "Roles" },
      {
        access: "organization-admin",
        href: "/demo/admin/projects",
        icon: mdiApplicationOutline,
        label: "Projects",
      },
      {
        access: "organization-admin",
        href: "/demo/admin/configuration/general",
        icon: mdiCogOutline,
        label: "Configuration",
      },
    ],
  },
  {
    access: "realm-admin",
    collapsible: true,
    icon: mdiDomain,
    label: "Realm",
    items: [
      { access: "realm-admin", href: "/demo/admin/realm", icon: mdiCogOutline, label: "Overview and settings" },
      {
        access: "realm-admin",
        href: "/demo/admin/realm/administrators",
        icon: mdiShieldCrownOutline,
        label: "Administrators",
      },
      {
        access: "realm-admin",
        href: "/demo/admin/organizations",
        icon: mdiOfficeBuildingOutline,
        label: "Organizations",
      },
      { access: "realm-admin", href: "/demo/admin/login-policy", icon: mdiTuneVariant, label: "Login and identity" },
      { access: "realm-admin", href: "/demo/admin/oidc-clients", icon: mdiOpenid, label: "OIDC clients" },
      { access: "realm-admin", href: "/demo/admin/signing-keys", icon: mdiKeyChain, label: "Signing keys" },
      {
        access: "realm-admin",
        href: "/demo/admin/oidc-consents",
        icon: mdiCheckDecagramOutline,
        label: "Application consents",
      },
      {
        access: "realm-admin",
        href: "/demo/admin/protocol-documents",
        icon: mdiFileDocumentOutline,
        label: "Protocol documents",
      },
      { access: "realm-admin", href: "/demo/admin/sessions", icon: mdiMonitorCellphone, label: "Sessions" },
      { access: "realm-admin", href: "/demo/admin/events", icon: mdiClipboardTextOutline, label: "Events" },
    ],
  },
]

const demoShellAccessResolve = (access: AdminDemoAccess) =>
  productionShellAccessResolve({
    capabilities: { realmAdministrator: access === "realm-admin", realmRead: access === "realm-admin" },
    organizationRoles: access === "owner" ? ["owner"] : access === "admin" ? ["admin"] : [],
    subjectType: "user",
  })

const demoNavLabelTranslate = (label: string): string => {
  switch (label) {
    case "Users":
      return messageTranslate("shell.nav.users")
    case "Roles":
      return messageTranslate("shell.nav.roles")
    case "Projects":
      return messageTranslate("shell.nav.projects")
    case "Configuration":
      return messageTranslate("shell.nav.configuration")
    case "Overview and settings":
      return messageTranslate("shell.nav.realmOverviewSettings")
    case "Administrators":
      return messageTranslate("shell.nav.realmAdministrators")
    case "Organizations":
      return messageTranslate("shell.nav.organizations")
    case "Login and identity":
      return messageTranslate("shell.nav.loginPolicy")
    case "OIDC clients":
      return messageTranslate("shell.nav.oidcClients")
    case "Signing keys":
      return messageTranslate("shell.nav.signingKeys")
    case "Application consents":
      return messageTranslate("shell.nav.applicationConsents")
    case "Protocol documents":
      return messageTranslate("shell.nav.protocolDocuments")
    case "Sessions":
      return messageTranslate("shell.nav.sessions")
    case "Events":
      return messageTranslate("shell.nav.auditEvents")
    default:
      return label
  }
}

const demoRealmGroupOpenSchema = v.optional(v.picklist(["open", "closed"]), "closed")

function demoRealmGroupOpenStoredGet(): boolean {
  if (typeof localStorage === "undefined") return false
  return v.safeParse(demoRealmGroupOpenSchema, localStorage.getItem("authworks.demo.nav.realm-open")).output === "open"
}

function demoRealmGroupOpenStoredSet(open: boolean): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem("authworks.demo.nav.realm-open", open ? "open" : "closed")
  } catch {
    // Browsers may block storage; the group simply falls back to closed.
  }
}

export function adminDemoAppStateCreate() {
  const location = useLocation()
  const sidebar = createSidebarState()
  const realmGroupManual = createSignalObject<boolean | undefined>(undefined)
  const access = () => adminDemoAccessSelect(location.search)
  const shellAccess = () => demoShellAccessResolve(access())

  const translatedGroups = (): AdminDemoNavGroup[] =>
    demoNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items
          .filter((item) => productionShellAccessPermits(item.access, shellAccess()))
          .map((item) => ({ ...item, label: demoNavLabelTranslate(item.label) })),
      }))
      .filter((group) => group.items.length > 0)
      .filter((group) => group.access === undefined || productionShellAccessPermits(group.access, shellAccess()))

  const groupOpen = (group: AdminDemoNavGroup) => {
    if (group.collapsible !== true) return true
    if (realmGroupManual.get() !== undefined) return realmGroupManual.get() as boolean
    if (group.items.some((item) => item.href === location.pathname)) return true
    return demoRealmGroupOpenStoredGet()
  }

  const groupToggle = (group: AdminDemoNavGroup) => {
    const next = !groupOpen(group)
    realmGroupManual.set(next)
    demoRealmGroupOpenStoredSet(next)
  }

  return {
    access,
    collapseVisible: () => !sidebar.isMobile.get(),
    destinationSelect: () => authenticatedSidebarDestinationSelect(sidebar),
    groupOpen,
    groupToggle,
    groupLabel: (group: AdminDemoNavGroup) =>
      group.label === "Realm" ? messageTranslate("shell.nav.realmGroup") : (group.label ?? ""),
    isActive: (href: string) =>
      location.pathname === href || (href !== "/demo/admin" && location.pathname.startsWith(`${href}/`)),
    navigationGroups: translatedGroups,
    sidebar,
    topBarVisible: () => sidebar.isMobile.get() || !sidebar.openDesktop.get(),
  }
}
