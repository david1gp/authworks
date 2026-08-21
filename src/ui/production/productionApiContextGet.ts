import { useContext } from "solid-js"
import { productionApiContext } from "./productionApiContext.js"

export function productionApiContextGet() {
  return useContext(productionApiContext)
}
