import { useLocation, useNavigate } from "@solidjs/router"
import { onMount } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { productionRealmIdResolve } from "../../../ui/production/productionRealmIdResolve.js"
import { productionRouteParamGet } from "../../../ui/production/productionRouteParamGet.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { adminApiCreate } from "./adminApiCreate.js"
import { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminProductionAdapterCreate } from "./adminProductionAdapterCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

export function adminProductionStateCreate(screen: () => AdminScreen) {
  const session = productionSessionContextGet()
  const location = useLocation()
  const navigate = useNavigate()
  const fallbackRealmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : (session.realms[0]?.id ?? "")
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

  return adminPageStateCreate({
    adapter: adminProductionAdapterCreate({ api: adminApiCreate({ baseUrl }), realmId: realmId.get }),
    reloadKey: realmId.get,
    screen,
    search: () => new URLSearchParams(location.search).get("q") ?? "",
    searchSet: (value: string) => {
      const search = new URLSearchParams(location.search)
      if (value.length === 0) search.delete("q")
      else search.set("q", value)
      const encoded = search.toString()
      navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
    },
    userId: () => productionRouteParamGet("/admin/users/:userId", location.pathname, "userId"),
  })
}
