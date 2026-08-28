import type { SidebarState } from "#ui/interactive/sidebar/SidebarState.jsx"

/**
 * Closes the mobile navigation drawer once a destination is chosen, so the selected page is
 * visible immediately instead of staying hidden behind the drawer.
 */
export function authenticatedSidebarDestinationSelect(sidebar: SidebarState) {
  if (!sidebar.openMobile.get()) return
  sidebar.openMobile.set(false)
}
