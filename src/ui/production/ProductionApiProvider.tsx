import { productionApiContext as ProductionApiContext } from "./productionApiContext.js"
import type { ProductionApiContextValue } from "./productionApiContextValue.js"
import { type JSX } from "@solidjs/web"

export function ProductionApiProvider(props: {
  readonly children: JSX.Element
  readonly value: ProductionApiContextValue
}) {
  return <ProductionApiContext value={props.value}>{props.children}</ProductionApiContext>
}
