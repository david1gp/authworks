import { useLocation } from "@solidjs/router"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"

/**
 * Groups the demo destinations the same way the production administration shell does,
 * so both navigations share one information architecture.
 */
const navigationGroups = [
  {
    label: "Realm",
    items: [
      { href: "/demo/admin", label: "Directory" },
      { href: "/demo/admin/sign-in", label: "Administrator sign-in" },
      { href: "/demo/admin/overview", label: "Realm overview" },
      { href: "/demo/admin/realm", label: "Realm settings" },
      { href: "/demo/admin/branding", label: "Branding" },
      { href: "/demo/admin/login-policy", label: "Login and identity" },
    ],
  },
  {
    label: "Directory",
    items: [
      { href: "/demo/admin/organizations", label: "Organizations" },
      { href: "/demo/admin/memberships", label: "Members and roles" },
      { href: "/demo/admin/invitations", label: "Invitations" },
      { href: "/demo/admin/domains", label: "Domains" },
      { href: "/demo/admin/users", label: "Users" },
    ],
  },
  {
    label: "Applications",
    items: [{ href: "/demo/admin/projects", label: "Projects" }],
  },
  {
    label: "OpenID Connect",
    items: [
      { href: "/demo/admin/oidc-clients", label: "OIDC clients" },
      { href: "/demo/admin/signing-keys", label: "Signing keys" },
      { href: "/demo/admin/oidc-consents", label: "Application consents" },
      { href: "/demo/admin/protocol-documents", label: "Protocol documents" },
    ],
  },
  {
    label: "Operations",
    items: [{ href: "/demo/admin/events", label: "Events" }],
  },
] as const

export function adminDemoAppStateCreate() {
  const location = useLocation()
  const sidebar = createSidebarState()

  return {
    isActive: (href: string) =>
      location.pathname === href || (href !== "/demo/admin" && location.pathname.startsWith(`${href}/`)),
    navigationGroups,
    sidebar,
  }
}
