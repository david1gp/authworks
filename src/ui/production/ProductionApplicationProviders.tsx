import type { JSX } from "solid-js"
import { ProductionApiProvider } from "./ProductionApiProvider.js"
import { ProductionSessionProvider } from "./ProductionSessionProvider.js"
import type { ProductionApiContextValue } from "./productionApiContextValue.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"

export function ProductionApplicationProviders(props: {
  readonly api: ProductionApiContextValue
  readonly children: JSX.Element
  readonly session: ProductionSessionContextValue
}) {
  return (
    <ProductionApiProvider value={props.api}>
      <ProductionSessionProvider value={props.session}>{props.children}</ProductionSessionProvider>
    </ProductionApiProvider>
  )
}
