import { useSearchParams } from "@solidjs/router"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { impersonationAdminPageStateCreate } from "./impersonationAdminPageStateCreate.js"
import { impersonationAdminProductionAdapterCreate } from "./impersonationAdminProductionAdapterCreate.js"

export function impersonationAdminProductionStateCreate() {
  const session = productionSessionContextGet()
  // The pre-selected subject lives in the URL, so a deep link from a user detail survives reloads.
  const [searchParams] = useSearchParams<{ userId?: string }>()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }

  return impersonationAdminPageStateCreate({
    adapter: impersonationAdminProductionAdapterCreate({
      baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
      realmId,
    }),
    confirm: (message) => window.confirm(message),
    now: () => Date.now(),
    targetUserId: () => searchParams.userId,
  })
}
