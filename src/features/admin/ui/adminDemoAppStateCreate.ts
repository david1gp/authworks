import { mdiAccountMultipleOutline } from "@adaptive-ds/mdi/mdiAccountMultipleOutline.js"
import { mdiAccountSwitchOutline } from "@adaptive-ds/mdi/mdiAccountSwitchOutline.js"
import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiCheckDecagramOutline } from "@adaptive-ds/mdi/mdiCheckDecagramOutline.js"
import { mdiClipboardTextOutline } from "@adaptive-ds/mdi/mdiClipboardTextOutline.js"
import { mdiCogOutline } from "@adaptive-ds/mdi/mdiCogOutline.js"
import { mdiDomain } from "@adaptive-ds/mdi/mdiDomain.js"
import { mdiEmailPlusOutline } from "@adaptive-ds/mdi/mdiEmailPlusOutline.js"
import { mdiFileDocumentOutline } from "@adaptive-ds/mdi/mdiFileDocumentOutline.js"
import { mdiKeyChain } from "@adaptive-ds/mdi/mdiKeyChain.js"
import { mdiLogin } from "@adaptive-ds/mdi/mdiLogin.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { mdiOpenid } from "@adaptive-ds/mdi/mdiOpenid.js"
import { mdiPaletteOutline } from "@adaptive-ds/mdi/mdiPaletteOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { mdiViewDashboardOutline } from "@adaptive-ds/mdi/mdiViewDashboardOutline.js"
import { mdiWeb } from "@adaptive-ds/mdi/mdiWeb.js"
import { useLocation } from "@solidjs/router"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"
import { authenticatedSidebarDestinationSelect } from "../../../ui/authenticated/authenticatedSidebarDestinationSelect.js"

/**
 * Groups the demo destinations the same way the production administration shell does,
 * so both navigations share one information architecture.
 */
const navigationGroups = [
  {
    icon: mdiDomain,
    label: "Realm",
    items: [
      { href: "/demo/admin", icon: mdiAccountMultipleOutline, label: "Directory" },
      { href: "/demo/admin/sign-in", icon: mdiLogin, label: "Administrator sign-in" },
      { href: "/demo/admin/overview", icon: mdiViewDashboardOutline, label: "Realm overview" },
      { href: "/demo/admin/realm", icon: mdiCogOutline, label: "Realm settings" },
      { href: "/demo/admin/branding", icon: mdiPaletteOutline, label: "Branding" },
      { href: "/demo/admin/login-policy", icon: mdiTuneVariant, label: "Login and identity" },
    ],
  },
  {
    icon: mdiAccountMultipleOutline,
    label: "Directory",
    items: [
      { href: "/demo/admin/organizations", icon: mdiOfficeBuildingOutline, label: "Organizations" },
      { href: "/demo/admin/memberships", icon: mdiAccountMultipleOutline, label: "Members and roles" },
      { href: "/demo/admin/invitations", icon: mdiEmailPlusOutline, label: "Invitations" },
      { href: "/demo/admin/domains", icon: mdiWeb, label: "Domains" },
      { href: "/demo/admin/users", icon: mdiAccountMultipleOutline, label: "Users" },
    ],
  },
  {
    icon: mdiApplicationOutline,
    label: "Applications",
    items: [{ href: "/demo/admin/projects", icon: mdiApplicationOutline, label: "Projects" }],
  },
  {
    icon: mdiOpenid,
    label: "OpenID Connect",
    items: [
      { href: "/demo/admin/oidc-clients", icon: mdiOpenid, label: "OIDC clients" },
      { href: "/demo/admin/signing-keys", icon: mdiKeyChain, label: "Signing keys" },
      { href: "/demo/admin/oidc-consents", icon: mdiCheckDecagramOutline, label: "Application consents" },
      { href: "/demo/admin/protocol-documents", icon: mdiFileDocumentOutline, label: "Protocol documents" },
    ],
  },
  {
    icon: mdiClipboardTextOutline,
    label: "Operations",
    items: [
      { href: "/demo/admin/sessions", icon: mdiMonitorCellphone, label: "Sessions" },
      { href: "/demo/admin/events", icon: mdiClipboardTextOutline, label: "Events" },
    ],
  },
] as const

export function adminDemoAppStateCreate() {
  const location = useLocation()
  const sidebar = createSidebarState()

  return {
    destinationSelect: () => authenticatedSidebarDestinationSelect(sidebar),
    isActive: (href: string) =>
      location.pathname === href || (href !== "/demo/admin" && location.pathname.startsWith(`${href}/`)),
    navigationGroups,
    sidebar,
  }
}
