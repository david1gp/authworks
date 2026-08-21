import type { JSX } from "solid-js"
import { productionApiContext } from "./productionApiContext.js"
import type { ProductionApiContextValue } from "./productionApiContextValue.js"

export function ProductionApiProvider(props: {
  readonly children: JSX.Element
  readonly value: ProductionApiContextValue
}) {
  return <productionApiContext.Provider value={props.value}>{props.children}</productionApiContext.Provider>
}
