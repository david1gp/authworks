import { useLocation } from "@solidjs/router"
import * as v from "valibot"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"
import { accountSecurityScreenSchema } from "./accountSecurityScreenSchema.js"

export function accountDemoAppStateCreate() {
  const location = useLocation()
  const kind = () => {
    if (location.pathname === "/demo/account/profile") return "profile" as const
    if (location.pathname === "/demo/account/email") return "email" as const
    if (location.pathname === "/demo/account/password") return "password" as const
    if (location.pathname === "/demo/account/delete") return "delete" as const
    return undefined
  }
  const securityScreen = () => {
    const parsed = v.safeParse(accountSecurityScreenSchema, location.pathname.split("/").at(-1))
    return parsed.success ? parsed.output : undefined
  }
  const accessScreen = (): AccountAccessScreen | undefined => {
    if (location.pathname === "/demo/account/organizations") return "organizations"
    if (location.pathname === "/demo/account/consents") return "consents"
    if (location.pathname === "/demo/invitations") return "invitations"
    if (location.pathname === "/demo/invitations/accept") return "invitation"
    return undefined
  }
  return {
    accessScreen,
    isDirectory: () => location.pathname === "/demo/account",
    kind,
    path: () => location.pathname,
    securityScreen,
  }
}
