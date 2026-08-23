import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { oidcAdminProductionAdapterCreate } from "./oidcAdminProductionAdapterCreate.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"
import { oidcAdminScreenStateCreate } from "./oidcAdminScreenStateCreate.js"

export function oidcAdminProductionStateCreate(options: {
  readonly clientId: () => string | undefined
  readonly screen: () => OidcAdminScreen
}) {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }

  return oidcAdminScreenStateCreate({
    adapter: oidcAdminProductionAdapterCreate({ baseUrl: window.location.origin, realmId }),
    basePath: "/admin",
    clientId: options.clientId,
    screen: options.screen,
  })
}
