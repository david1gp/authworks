import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { machineAdminProductionAdapterCreate } from "./machineAdminProductionAdapterCreate.js"
import { machineAdminScreenStateCreate } from "./machineAdminScreenStateCreate.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"

export function machineAdminProductionStateCreate(options: {
  readonly machineUserId: () => string | undefined
  readonly screen: () => MachineAdminScreen
}) {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }

  return machineAdminScreenStateCreate({
    adapter: machineAdminProductionAdapterCreate({ baseUrl: window.location.origin, realmId }),
    basePath: "/admin",
    confirm: (message) => window.confirm(message),
    machineUserId: options.machineUserId,
    now: () => Date.now(),
    screen: options.screen,
  })
}
