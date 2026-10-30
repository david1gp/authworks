import { useLocation } from "@solidjs/router"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"

export function accountDemoAppStateCreate() {
  const location = useLocation()
  const accessScreen = (): AccountAccessScreen | undefined => {
    if (location.pathname === "/demo/invitations") return "invitations"
    if (location.pathname === "/demo/invitations/accept") return "invitation"
    return undefined
  }
  return {
    accessScreen,
    isWorkspace: () => location.pathname === "/demo/account",
  }
}
