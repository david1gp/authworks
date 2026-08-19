import { useLocation } from "@solidjs/router"
import { createSidebarState } from "#ui/interactive/sidebar/createSidebarState.jsx"

export function adminDemoAppStateCreate() {
  const location = useLocation()
  const sidebar = createSidebarState()
  const navigation = [
    { href: "/demo/admin/organizations", label: "Organizations" },
    { href: "/demo/admin/users", label: "Users" },
    { href: "/demo/admin/projects", label: "Projects" },
    { href: "/demo/admin/events", label: "Events" },
  ]

  return {
    isActive: (href: string) =>
      location.pathname === href ||
      location.pathname.startsWith(`${href}/`) ||
      (href === "/demo/admin/organizations" && location.pathname === "/demo/admin"),
    navigation,
    sidebar,
  }
}
