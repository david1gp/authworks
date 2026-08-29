import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { mdiAccountRemoveOutline } from "@adaptive-ds/mdi/mdiAccountRemoveOutline.js"
import { mdiLockOpenOutline } from "@adaptive-ds/mdi/mdiLockOpenOutline.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiShieldLockOutline } from "@adaptive-ds/mdi/mdiShieldLockOutline.js"
import { onMount } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { AccountSectionNavItem } from "./accountSectionNavItem.js"
import { accountWorkspaceSectionIds } from "./accountWorkspaceSectionIds.js"

export function accountSectionNavStateCreate(locationHash?: () => string) {
  const currentHash = createSignalObject(typeof window === "undefined" ? "" : window.location.hash)

  onMount(() => {
    if (locationHash !== undefined) return
    const hashChange = () => currentHash.set(window.location.hash)
    window.addEventListener("hashchange", hashChange)
    return () => window.removeEventListener("hashchange", hashChange)
  })

  const items: readonly AccountSectionNavItem[] = [
    {
      href: `#${accountWorkspaceSectionIds.profile}`,
      icon: mdiAccountCircleOutline,
      id: accountWorkspaceSectionIds.profile,
      label: "shell.nav.profile",
    },
    {
      href: `#${accountWorkspaceSectionIds.security}`,
      icon: mdiShieldLockOutline,
      id: accountWorkspaceSectionIds.security,
      label: "shell.nav.security",
    },
    {
      href: `#${accountWorkspaceSectionIds.devicesApplications}`,
      icon: mdiMonitorCellphone,
      id: accountWorkspaceSectionIds.devicesApplications,
      label: "shell.nav.sessionsDevices",
    },
    {
      href: `#${accountWorkspaceSectionIds.access}`,
      icon: mdiLockOpenOutline,
      id: accountWorkspaceSectionIds.access,
      label: "shell.nav.access",
    },
    {
      href: `#${accountWorkspaceSectionIds.dangerZone}`,
      icon: mdiAccountRemoveOutline,
      id: accountWorkspaceSectionIds.dangerZone,
      label: "account.delete.dangerZone",
    },
  ]

  return {
    isActive: (id: string) => {
      const hash = locationHash?.() ?? currentHash.get()
      if (hash.length === 0) return id === accountWorkspaceSectionIds.profile
      return hash === `#${id}`
    },
    items: () => items,
  }
}
