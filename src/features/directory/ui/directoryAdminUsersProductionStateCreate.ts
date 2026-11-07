import { useLocation, useNavigate } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { directoryAdminProductionAdapterCreate } from "./directoryAdminProductionAdapterCreate.js"
import { directoryAdminUsersPageStateCreate } from "./directoryAdminUsersPageStateCreate.js"
import { directoryTeamsDialogsStateCreate } from "./directoryTeamsDialogsStateCreate.js"
import { directoryTeamsPageStateCreate } from "./directoryTeamsPageStateCreate.js"
import { directoryTeamsProductionAdapterCreate } from "./directoryTeamsProductionAdapterCreate.js"

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
  // Organization owners/admins (and realm administrators) manage every team; a plain
  // member who leads a team is scoped to the Teams tab of their own team instead.
  const canManageAll = () => {
    const access = session.guard.access
    if (access === "loading") return true
    if (access.realmAdministrator) return true
    return access.organizationRoles.includes("owner") || access.organizationRoles.includes("admin")
  }
  const actorUserId = () => {
    const authentication = session.guard.authentication
    return typeof authentication === "object" ? authentication.userId : undefined
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
    tabForce: () => (canManageAll() ? undefined : "teams"),
  })
  const teamsAdapter = directoryTeamsProductionAdapterCreate({
    baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
    organizationId,
    realmId,
  })
  const teams = directoryTeamsPageStateCreate({
    actorUserId,
    adapter: teamsAdapter,
    canManageAll,
    confirm: confirmState.confirm,
    leaderDefaultTeamSelect: (slug) => {
      const params = new URLSearchParams(location.search)
      params.set("tab", "teams")
      params.set("team", slug)
      const encoded = params.toString()
      navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
    },
    organizationId,
    realmId,
    search,
  })
  const teamsDialogs = directoryTeamsDialogsStateCreate({ page: teams })
  return {
    basePath: "/admin",
    confirmState,
    navigate,
    organizationId,
    page,
    realmAdministrator,
    search,
    teams,
    teamsDialogs,
  }
}
