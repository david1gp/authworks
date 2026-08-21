import type { JSX } from "solid-js"
import { productionSessionContext } from "./productionSessionContext.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"

export function ProductionSessionProvider(props: {
  readonly children: JSX.Element
  readonly value: ProductionSessionContextValue
}) {
  return <productionSessionContext.Provider value={props.value}>{props.children}</productionSessionContext.Provider>
}
