import { useSearchParams } from "@solidjs/router"
import { onMount } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionRealmIdResolve } from "../../../ui/production/productionRealmIdResolve.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { impersonationAdminPageStateCreate } from "./impersonationAdminPageStateCreate.js"
import { impersonationAdminProductionAdapterCreate } from "./impersonationAdminProductionAdapterCreate.js"

export function impersonationAdminProductionStateCreate() {
  const session = productionSessionContextGet()
  // The pre-selected subject lives in the URL, so a deep link from a user detail survives reloads.
  const [searchParams] = useSearchParams<{ userId?: string }>()
  const fallbackRealmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin
  const realmId = createSignalObject(fallbackRealmId())
  onMount(() => {
    void productionRealmIdResolve({
      baseUrl,
      domain: typeof window === "undefined" ? "localhost" : window.location.host,
      fallbackRealmId: fallbackRealmId(),
    }).then(realmId.set)
  })

  // The same localized dialog as the demo answers the destructive end action.
  const confirmState = confirmStateCreate()
  const page = impersonationAdminPageStateCreate({
    adapter: impersonationAdminProductionAdapterCreate({
      baseUrl,
      realmId: realmId.get,
    }),
    confirm: confirmState.confirm,
    now: () => Date.now(),
    reloadKey: realmId.get,
    targetUserId: () => searchParams.userId,
  })

  return { ...page, confirmState }
}
