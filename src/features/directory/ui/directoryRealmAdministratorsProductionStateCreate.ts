import { useLocation, useNavigate } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { directoryRealmAdministratorsPageStateCreate } from "./directoryRealmAdministratorsPageStateCreate.js"
import { directoryRealmAdministratorsProductionAdapterCreate } from "./directoryRealmAdministratorsProductionAdapterCreate.js"
import { directoryRealmAdministratorsViewStateCreate } from "./directoryRealmAdministratorsViewStateCreate.js"

/** Binds the realm administrators screen to realm-scoped browser clients and URL-held dialog state. */
export function directoryRealmAdministratorsProductionStateCreate() {
  const session = productionSessionContextGet()
  const location = useLocation()
  const navigate = useNavigate()
  const confirmState = confirmStateCreate()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const adapter = directoryRealmAdministratorsProductionAdapterCreate({
    baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
    realmId,
  })
  const page = directoryRealmAdministratorsPageStateCreate({
    adapter,
    cacheKey: () => `authworks.admin.realmAdministrators.${realmId()}`,
    confirm: confirmState.confirm,
    realmId: realmId(),
    search: () => location.search,
  })
  const view = directoryRealmAdministratorsViewStateCreate({ navigate, page, search: () => location.search })
  return { confirmState, page, view }
}
