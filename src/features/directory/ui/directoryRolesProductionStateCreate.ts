import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { directoryRolesPageStateCreate } from "./directoryRolesPageStateCreate.js"
import { directoryRolesProductionAdapterCreate } from "./directoryRolesProductionAdapterCreate.js"
import { directoryRolesViewStateCreate } from "./directoryRolesViewStateCreate.js"

/** Binds the roles screen to realm-scoped browser clients and the active session context. */
export function directoryRolesProductionStateCreate() {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : ""
  }
  const cacheKey = () => `authworks.admin.roles.${realmId()}.${organizationId()}`
  const canManage = () => {
    const access = session.guard.access
    if (access === "loading") return false
    return access.realmAdministrator || access.organizationRoles.some((role) => role === "owner" || role === "admin")
  }
  const confirmState = confirmStateCreate()
  const adapter = directoryRolesProductionAdapterCreate({
    baseUrl: window.location.origin,
    organizationId,
    realmId,
  })
  const page = directoryRolesPageStateCreate({
    adapter,
    cacheKey,
    canManage,
    confirm: confirmState.confirm,
    organizationId,
  })
  const view = directoryRolesViewStateCreate({ asParam: () => undefined, basePath: "/admin", page })

  return { confirmState, view }
}
