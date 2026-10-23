import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { machineAdminProductionAdapterCreate } from "./machineAdminProductionAdapterCreate.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"
import { machineAdminScreenStateCreate } from "./machineAdminScreenStateCreate.js"

export function machineAdminProductionStateCreate(options: {
  readonly machineUserId: () => string | undefined
  readonly screen: () => MachineAdminScreen
}) {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : ""
  }

  return machineAdminScreenStateCreate({
    adapter: machineAdminProductionAdapterCreate({ baseUrl: window.location.origin, organizationId, realmId }),
    basePath: "/admin",
    machineUserId: options.machineUserId,
    now: () => Date.now(),
    screen: options.screen,
  })
}
