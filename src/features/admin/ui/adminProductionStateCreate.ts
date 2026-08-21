import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { adminApiCreate } from "./adminApiCreate.js"
import { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminProductionAdapterCreate } from "./adminProductionAdapterCreate.js"
import type { AdminScreen } from "./adminScreenSchema.js"

export function adminProductionStateCreate(screen: () => AdminScreen) {
  const session = productionSessionContextGet()
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ userId?: string }>()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : (session.realms[0]?.id ?? "")
  }
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin

  return adminPageStateCreate({
    adapter: adminProductionAdapterCreate({ api: adminApiCreate({ baseUrl }), realmId }),
    screen,
    search: () => new URLSearchParams(location.search).get("q") ?? "",
    searchSet: (value: string) => {
      const search = new URLSearchParams(location.search)
      if (value.length === 0) search.delete("q")
      else search.set("q", value)
      const encoded = search.toString()
      navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
    },
    userId: () => params.userId,
  })
}
