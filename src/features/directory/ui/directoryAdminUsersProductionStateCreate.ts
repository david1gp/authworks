import { useLocation, useNavigate } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { directoryAdminProductionAdapterCreate } from "./directoryAdminProductionAdapterCreate.js"
import { directoryAdminUsersPageStateCreate } from "./directoryAdminUsersPageStateCreate.js"

/** Binds the users page to realm-scoped browser clients and URL-held filter state. */
export function directoryAdminUsersProductionStateCreate() {
  const session = productionSessionContextGet()
  const location = useLocation()
  const navigate = useNavigate()
  const confirmState = confirmStateCreate()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : ""
  }
  const realmAdministrator = () => {
    const access = session.guard.access
    return access !== "loading" && access.realmAdministrator
  }
  const adapter = directoryAdminProductionAdapterCreate({
    baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
    organizationId,
    realmId,
  })
  const search = () => location.search
  const page = directoryAdminUsersPageStateCreate({
    adapter,
    confirm: confirmState.confirm,
    invitationOrigin: window.location.origin,
    organizationId,
    realmAdministrator,
    realmId,
    search,
  })
  return { basePath: "/admin", confirmState, navigate, organizationId, page, realmAdministrator, search }
}
