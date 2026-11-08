import { useLocation } from "@solidjs/router"
import { productionOrganizationBasePathGet } from "../../../ui/production/productionOrganizationBasePathGet.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { machineAdminProductionAdapterCreate } from "./machineAdminProductionAdapterCreate.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"
import { machineAdminScreenStateCreate } from "./machineAdminScreenStateCreate.js"

export function machineAdminProductionStateCreate(options: {
  readonly machineUserId: () => string | undefined
  readonly screen: () => MachineAdminScreen
}) {
  const session = productionSessionContextGet()
  const location = useLocation()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : ""
  }
  const organizationBasePath = () =>
    productionOrganizationBasePathGet({
      organizationId: organizationId() === "" ? undefined : organizationId(),
      organizations: session.organizations,
      pathname: location.pathname,
    })

  return machineAdminScreenStateCreate({
    adapter: machineAdminProductionAdapterCreate({ baseUrl: window.location.origin, organizationId, realmId }),
    basePath: organizationBasePath,
    machineUserId: options.machineUserId,
    now: () => Date.now(),
    screen: options.screen,
  })
}
