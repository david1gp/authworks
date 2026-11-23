import { productionSessionContext as ProductionSessionContext } from "./productionSessionContext.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"
import { type JSX } from "@solidjs/web"

export function ProductionSessionProvider(props: {
  readonly children: JSX.Element
  readonly value: ProductionSessionContextValue
}) {
  return <ProductionSessionContext value={props.value}>{props.children}</ProductionSessionContext>
}
