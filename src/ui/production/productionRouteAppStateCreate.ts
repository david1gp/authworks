import { useLocation } from "@solidjs/router"
import type { Accessor } from "solid-js"
import { createEffect } from "solid-js"
import { productionApiContextGet } from "./productionApiContextGet.js"
import { productionLoginRedirectUrlCreate } from "./productionLoginRedirectUrlCreate.js"
import type { ProductionRouteContract } from "./productionRouteContract.js"
import { productionRouteGuardStateCreate } from "./productionRouteGuardStateCreate.js"
import { productionRouteParamGet } from "./productionRouteParamGet.js"
import { productionRouteScreenSelect } from "./productionRouteScreenSelect.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"
import { productionShellKindSelect } from "./productionShellKindSelect.js"

type ProductionRouteAppStateCreateOptions = {
  readonly location?: Pick<Location, "hash" | "pathname" | "search">
  readonly session?: ProductionSessionContextValue
}

export function productionRouteAppStateCreate(
  route: Accessor<ProductionRouteContract>,
  options: ProductionRouteAppStateCreateOptions = {},
) {
  const api = productionApiContextGet()
  const location = options.location ?? useLocation()
  const session = options.session ?? productionSessionContextGet()
  const screen = () => productionRouteScreenSelect(route(), location.pathname)
  const guardState = () => productionRouteGuardStateCreate(screen()?.guard ?? route().guard, session.guard)

  createEffect(() => {
    if (guardState().status !== "anonymous") return
    window.location.assign(productionLoginRedirectUrlCreate(window.location))
  })

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
