import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { projectAdminProductionAdapterCreate } from "./projectAdminProductionAdapterCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"
import { projectAdminScreenStateCreate } from "./projectAdminScreenStateCreate.js"

export function projectAdminProductionStateCreate(options: {
  readonly projectId: () => string | undefined
  readonly screen: () => ProjectAdminScreen
}) {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }

  return projectAdminScreenStateCreate({
    adapter: projectAdminProductionAdapterCreate({ baseUrl: window.location.origin, realmId }),
    basePath: "/admin",
    projectId: options.projectId,
    screen: options.screen,
  })
}
