import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { projectAdminProductionAdapterCreate } from "./projectAdminProductionAdapterCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"
import { projectAdminScreenStateCreate } from "./projectAdminScreenStateCreate.js"

/** Binds the project screens to realm-scoped browser clients and the active session context. */
export function projectAdminProductionStateCreate(options: {
  readonly projectId: () => string | undefined
  readonly screen: () => ProjectAdminScreen
}) {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : undefined
  }
  const canManage = () => {
    const access = session.guard.access
    if (access === "loading") return false
    return access.realmAdministrator || access.organizationRoles.some((role) => role === "owner" || role === "admin")
  }

  return projectAdminScreenStateCreate({
    adapter: projectAdminProductionAdapterCreate({ baseUrl: window.location.origin, realmId }),
    basePath: "/admin",
    canManage,
    organizationId,
    projectId: options.projectId,
    screen: options.screen,
    withActor: (href) => href,
  })
}
