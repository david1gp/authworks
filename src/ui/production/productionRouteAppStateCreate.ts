import { useLocation } from "@solidjs/router"
import type { Accessor } from "solid-js"
import { productionApiContextGet } from "./productionApiContextGet.js"
import type { ProductionRouteContract } from "./productionRouteContract.js"
import { productionRouteGuardStateCreate } from "./productionRouteGuardStateCreate.js"
import { productionRouteParamGet } from "./productionRouteParamGet.js"
import { productionRouteScreenSelect } from "./productionRouteScreenSelect.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import { productionShellKindSelect } from "./productionShellKindSelect.js"

export function productionRouteAppStateCreate(route: Accessor<ProductionRouteContract>) {
  const api = productionApiContextGet()
  const location = useLocation()
  const session = productionSessionContextGet()
  const screen = () => productionRouteScreenSelect(route(), location.pathname)
  const guardState = () => productionRouteGuardStateCreate(screen()?.guard ?? route().guard, session.guard)

  return {
    api,
    guardState,
    routeParam: (name: string) => {
      const current = screen()
      return current === undefined ? undefined : productionRouteParamGet(current.path, location.pathname, name)
    },
    screen,
    shellKind: () => productionShellKindSelect(route()),
  }
}
